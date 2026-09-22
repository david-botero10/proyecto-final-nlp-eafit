"""QLoRA 4-bit sobre train+val. El adapter no se comitea."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from .constantes import MODELO_BASE
from .modelo import cargar_4bit, regex_lora
from .prompt import construir_mensajes

_RAIZ = Path(__file__).resolve().parents[2]


def leer_jsonl(ruta: Path) -> list[dict]:
    """Lee un JSONL de órdenes."""
    filas = []
    for linea in ruta.read_text(encoding="utf-8-sig").splitlines():
        if linea.strip():
            filas.append(json.loads(linea))
    return filas


def _peor_longitud(tokenizer, filas: list[dict]) -> int:
    """Tokens del ejemplo más largo, para no truncar la respuesta."""
    from .modelo import aplicar_plantilla

    peor = 0
    for fila in filas:
        texto = aplicar_plantilla(tokenizer, construir_mensajes(fila, True), False)
        n = len(tokenizer(texto, add_special_tokens=False).input_ids)
        if n > peor:
            peor = n
    return peor


def _dataset(filas: list[dict]):
    from datasets import Dataset

    mensajes = []
    for fila in filas:
        mensajes.append(
            {
                "messages": construir_mensajes(fila, con_respuesta=True),
                "chat_template_kwargs": {"enable_thinking": False},
            }
        )
    return Dataset.from_list(mensajes)


def _config_lora(modelo, rango: int):
    from peft import LoraConfig

    return LoraConfig(
        r=rango,
        lora_alpha=rango * 2,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=regex_lora(modelo),
    )


def _construir_entrenador(modelo, tokenizer, dataset, args, lora):
    """Crea el SFTTrainer y descarta kwargs que la versión instalada no acepte."""
    from peft import prepare_model_for_kbit_training
    from trl import SFTConfig, SFTTrainer

    modelo = prepare_model_for_kbit_training(
        modelo, use_gradient_checkpointing=True
    )
    candidatos = {
        "output_dir": str(args.salida / "_trainer"),
        "num_train_epochs": args.epocas,
        "per_device_train_batch_size": args.batch,
        "gradient_accumulation_steps": args.grad_acum,
        "learning_rate": args.lr,
        "logging_steps": 5,
        "save_strategy": "no",
        "bf16": True,
        "fp16": False,
        "gradient_checkpointing": True,
        "gradient_checkpointing_kwargs": {"use_reentrant": False},
        "max_length": args.max_longitud,
        "packing": False,
        "report_to": "none",
        "seed": 42,
        "optim": "adamw_8bit",
        "dataloader_num_workers": 0,
        "assistant_only_loss": True,
        "remove_unused_columns": False,
    }
    try:
        aceptados = set(SFTConfig.__dataclass_fields__)
    except AttributeError:
        aceptados = set(candidatos)
    filtrados = {
        clave: valor for clave, valor in candidatos.items() if clave in aceptados
    }
    config = SFTConfig(**filtrados)
    try:
        entrenador = SFTTrainer(
            model=modelo,
            args=config,
            train_dataset=dataset,
            processing_class=tokenizer,
            peft_config=lora,
        )
    except TypeError:
        entrenador = SFTTrainer(
            model=modelo,
            args=config,
            train_dataset=dataset,
            tokenizer=tokenizer,
            peft_config=lora,
        )
    return entrenador


def entrenar(args: argparse.Namespace) -> dict:
    """Corre el fine-tuning y escribe metricas.json junto al adapter."""
    import torch

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA no está disponible; el QLoRA de C3 exige la GPU local")
    torch.cuda.reset_peak_memory_stats()
    filas = leer_jsonl(args.train) + leer_jsonl(args.val)
    dataset = _dataset(filas)
    modelo, tokenizer = cargar_4bit(args.modelo)
    peor = _peor_longitud(tokenizer, filas)
    if peor > args.max_longitud:
        raise RuntimeError(
            f"hay un ejemplo de {peor} tokens y --max-longitud es {args.max_longitud}"
        )
    print(f"tokens del ejemplo más largo: {peor}")
    lora = _config_lora(modelo, args.r)
    entrenador = _construir_entrenador(modelo, tokenizer, dataset, args, lora)
    inicio = time.perf_counter()
    resultado = entrenador.train()
    segundos = time.perf_counter() - inicio
    args.salida.mkdir(parents=True, exist_ok=True)
    entrenador.save_model(str(args.salida))
    tokenizer.save_pretrained(str(args.salida))
    vram = int(torch.cuda.max_memory_allocated())
    loss = getattr(resultado, "training_loss", None)
    metricas = {
        "modelo_base": args.modelo,
        "loss_final": loss,
        "segundos": round(segundos, 3),
        "vram_pico_bytes": vram,
        "vram_pico_mib": round(vram / (1024 * 1024), 2),
        "gpu": torch.cuda.get_device_name(0),
        "ejemplos": len(filas),
        "hiperparametros": {
            "epocas": args.epocas,
            "lr": args.lr,
            "r": args.r,
            "lora_alpha": args.r * 2,
            "lora_dropout": 0.05,
            "batch": args.batch,
            "grad_acum": args.grad_acum,
            "max_longitud": args.max_longitud,
            "optim": "adamw_8bit",
            "cuantizacion": "bitsandbytes nf4 double quant",
            "modulos_lora": lora.target_modules,
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


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos pedidos por la spec, más acumulación y longitud."""
    parser = argparse.ArgumentParser(
        description="Entrena el extractor QLoRA v1 de Relevo."
    )
    parser.add_argument("--epocas", type=float, default=3)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--r", type=int, default=16)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--grad-acum", type=int, default=8)
    parser.add_argument("--max-longitud", type=int, default=1536)
    parser.add_argument("--modelo", default=MODELO_BASE)
    parser.add_argument(
        "--train",
        type=Path,
        default=_RAIZ / "data" / "ordenes" / "train.jsonl",
    )
    parser.add_argument(
        "--val",
        type=Path,
        default=_RAIZ / "data" / "ordenes" / "val.jsonl",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v1",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Punto de entrada del entrenamiento."""
    args = parser_cli().parse_args(argv)
    entrenar(args)
    return 0
