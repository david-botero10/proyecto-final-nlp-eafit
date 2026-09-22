"""DPO incremental: adapter v1 entrenable, referencia v1 congelada en PEFT."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from extractor.constantes import MODELO_BASE
from extractor.modelo import cargar_4bit

_RAIZ = Path(__file__).resolve().parents[2]


def leer_pares_dpo(ruta: Path) -> list[dict]:
    """Filas TRL. Ignora columnas que el entrenador no necesita."""
    filas = []
    for linea in ruta.read_text(encoding="utf-8-sig").splitlines():
        if not linea.strip():
            continue
        crudo = json.loads(linea)
        filas.append(
            {
                "prompt": crudo["prompt"],
                "chosen": crudo["chosen"],
                "rejected": crudo["rejected"],
                "chat_template_kwargs": crudo.get(
                    "chat_template_kwargs",
                    {"enable_thinking": False},
                ),
            }
        )
    return filas


def _config(args: argparse.Namespace, salida_trainer: Path):
    from trl import DPOConfig

    candidatos = {
        "output_dir": str(salida_trainer),
        "num_train_epochs": args.epocas,
        "per_device_train_batch_size": args.batch,
        "gradient_accumulation_steps": args.grad_acum,
        "learning_rate": args.lr,
        "beta": args.beta,
        "logging_steps": 1,
        "save_strategy": "no",
        "bf16": True,
        "fp16": False,
        "gradient_checkpointing": True,
        "gradient_checkpointing_kwargs": {"use_reentrant": False},
        "max_length": args.max_longitud,
        "report_to": "none",
        "seed": 42,
        "optim": "adamw_8bit",
        "dataloader_num_workers": 0,
        "remove_unused_columns": False,
        "dataset_num_proc": None,
        "truncation_mode": "keep_start",
    }
    try:
        aceptados = set(DPOConfig.__dataclass_fields__)
    except AttributeError:
        aceptados = set(candidatos)
    filtrados = {
        clave: valor for clave, valor in candidatos.items() if clave in aceptados
    }
    return DPOConfig(**filtrados)


def _cargar(args: argparse.Namespace):
    from peft import PeftModel, prepare_model_for_kbit_training

    modelo, tokenizer = cargar_4bit(args.modelo)
    modelo = prepare_model_for_kbit_training(
        modelo, use_gradient_checkpointing=True
    )
    modelo = PeftModel.from_pretrained(
        modelo, str(args.adapter), is_trainable=True
    )
    return modelo, tokenizer


def _historial(entrenador) -> list[dict]:
    eventos = []
    for evento in entrenador.state.log_history:
        limpio = {}
        for clave, valor in evento.items():
            if isinstance(valor, int | float):
                limpio[clave] = valor
        if limpio:
            eventos.append(limpio)
    return eventos


def _guardar(entrenador, tokenizer, salida: Path) -> None:
    modelo = entrenador.model
    if hasattr(modelo, "module"):
        modelo = modelo.module
    configurados = getattr(modelo, "peft_config", {})
    if "ref" in configurados:
        modelo.set_adapter("default")
        modelo.delete_adapter("ref")
    salida.mkdir(parents=True, exist_ok=True)
    modelo.save_pretrained(str(salida))
    tokenizer.save_pretrained(str(salida))


def _correr(args: argparse.Namespace) -> dict:
    import torch
    from datasets import Dataset
    from trl import DPOTrainer

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA no está disponible; el DPO exige la GPU local")
    torch.cuda.reset_peak_memory_stats()
    filas = leer_pares_dpo(args.pares)
    if not filas:
        raise RuntimeError(f"no hay pares DPO en {args.pares}")
    dataset = Dataset.from_list(filas)
    modelo, tokenizer = _cargar(args)
    config = _config(args, args.salida / "_trainer")
    try:
        entrenador = DPOTrainer(
            model=modelo,
            ref_model=None,
            args=config,
            train_dataset=dataset,
            processing_class=tokenizer,
        )
    except TypeError:
        entrenador = DPOTrainer(
            model=modelo,
            ref_model=None,
            args=config,
            train_dataset=dataset,
            tokenizer=tokenizer,
        )
    inicio = time.perf_counter()
    resultado = entrenador.train()
    segundos = time.perf_counter() - inicio
    _guardar(entrenador, tokenizer, args.salida)
    vram = int(torch.cuda.max_memory_allocated())
    historial = _historial(entrenador)
    precisiones = [
        evento["rewards/accuracies"]
        for evento in historial
        if "rewards/accuracies" in evento
    ]
    perdidas = [evento["loss"] for evento in historial if "loss" in evento]
    loss = getattr(resultado, "training_loss", None)
    metricas = {
        "modelo_base": args.modelo,
        "adapter_origen": str(args.adapter),
        "pares_leidos": len(filas),
        "pares_usados": len(entrenador.train_dataset),
        "loss_final": loss,
        "loss_media_log": (sum(perdidas) / len(perdidas)) if perdidas else None,
        "rewards/accuracies": (
            sum(precisiones) / len(precisiones) if precisiones else None
        ),
        "historial": historial,
        "segundos": round(segundos, 3),
        "vram_pico_bytes": vram,
        "vram_pico_mib": round(vram / (1024 * 1024), 2),
        "gpu": torch.cuda.get_device_name(0),
        "hiperparametros": {
            "epocas": args.epocas,
            "lr": args.lr,
            "beta": args.beta,
            "batch": args.batch,
            "grad_acum": args.grad_acum,
            "max_longitud": args.max_longitud,
            "optim": "adamw_8bit",
            "ref_model": None,
            "cuantizacion": "bitsandbytes nf4 double quant",
        },
    }
    destino = args.salida / "metricas.json"
    destino.write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(json.dumps(metricas, ensure_ascii=False, indent=2))
    return metricas


def entrenar(args: argparse.Namespace) -> dict:
    """Corre el DPO. Si la VRAM no alcanza, baja max_length y reintenta una vez."""
    try:
        return _correr(args)
    except RuntimeError as exc:
        if "out of memory" not in str(exc).lower() or args.max_longitud <= 768:
            raise
        print(
            f"VRAM insuficiente con max_length={args.max_longitud}; "
            "reintento con la mitad."
        )
        args.max_longitud = max(768, args.max_longitud // 2)
        import torch

        torch.cuda.empty_cache()
        return _correr(args)


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos del DPO incremental."""
    parser = argparse.ArgumentParser(
        description="Ajusta el extractor v1 con DPO y guarda extractor-v2."
    )
    parser.add_argument("--epocas", type=float, default=1)
    parser.add_argument("--lr", type=float, default=5e-6)
    parser.add_argument("--beta", type=float, default=0.1)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--grad-acum", type=int, default=4)
    parser.add_argument("--max-longitud", type=int, default=1536)
    parser.add_argument("--modelo", default=MODELO_BASE)
    parser.add_argument(
        "--adapter",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v1",
    )
    parser.add_argument(
        "--pares",
        type=Path,
        default=_RAIZ / "ml" / "runs" / "pares_dpo.jsonl",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v2",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Punto de entrada del entrenamiento DPO."""
    entrenar(parser_cli().parse_args(argv))
    return 0
