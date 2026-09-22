"""Evalúa el test set con el modelo base, el adapter LoRA o la API de xAI."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from .constantes import MODELO_BASE
from .metricas import ParEval, calcular_metricas, tabla_markdown
from .parser import parsear_extraccion
from .prompt import construir_mensajes

_RAIZ = Path(__file__).resolve().parents[2]
_URL_XAI = "https://api.x.ai/v1/chat/completions"


def leer_jsonl(ruta: Path) -> list[dict]:
    """Lee un JSONL de órdenes."""
    filas = []
    for linea in ruta.read_text(encoding="utf-8-sig").splitlines():
        if linea.strip():
            filas.append(json.loads(linea))
    return filas


def clave_xai() -> str | None:
    """Lee XAI_API_KEY del entorno o de .env, sin imprimirla."""
    if os.environ.get("XAI_API_KEY"):
        return os.environ["XAI_API_KEY"]
    ruta = _RAIZ / ".env"
    if not ruta.is_file():
        return None
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        clave, valor = limpia.split("=", 1)
        if clave.strip() == "XAI_API_KEY":
            secreto = valor.strip().strip('"').strip("'")
            return secreto or None
    return None


def completar_xai(mensajes: list[dict]) -> str:
    """Una completación. El error no incluye la clave."""
    clave = clave_xai()
    if not clave:
        raise RuntimeError("sin clave")
    cuerpo = json.dumps(
        {
            "model": os.environ.get("XAI_MODEL", "grok-4.6"),
            "messages": mensajes,
            "temperature": 0,
        }
    ).encode("utf-8")
    solicitud = urllib.request.Request(
        _URL_XAI,
        data=cuerpo,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {clave}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(solicitud, timeout=120) as respuesta:
            data = json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"xAI respondió HTTP {exc.code}") from None
    return str(data["choices"][0]["message"]["content"])


def _generar_local(modelo, tokenizer, fila: dict) -> str:
    import torch

    from .modelo import aplicar_plantilla

    prompt = aplicar_plantilla(tokenizer, construir_mensajes(fila, False), True)
    entradas = tokenizer(prompt, return_tensors="pt")
    entradas = {clave: tensor.to(modelo.device) for clave, tensor in entradas.items()}
    with torch.inference_mode():
        salida = modelo.generate(
            **entradas,
            max_new_tokens=256,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id,
        )
    nuevo = salida[0, entradas["input_ids"].shape[1] :]
    return tokenizer.decode(nuevo, skip_special_tokens=True)


def _cargar_local(proveedor: str, adapter: Path, modelo_id: str):
    from .modelo import cargar_4bit

    modelo, tokenizer = cargar_4bit(modelo_id)
    if proveedor == "lora":
        from peft import PeftModel

        modelo = PeftModel.from_pretrained(modelo, str(adapter))
    modelo.eval()
    return modelo, tokenizer


def evaluar_filas(filas: list[dict], completar) -> dict:
    """Corre `completar(fila) -> str` y calcula las métricas."""
    pares: list[ParEval] = []
    detalle = []
    for fila in filas:
        crudo = completar(fila)
        parseo = parsear_extraccion(crudo)
        par = ParEval(
            esperado=fila["esperado"],
            prediccion=parseo["valor"],
            json_ok=parseo["ok"],
        )
        pares.append(par)
        detalle.append(
            {
                "orden": fila["orden"],
                "fecha_referencia": fila["fecha_referencia"],
                "esperado": fila["esperado"],
                "prediccion": parseo["valor"],
                "json_ok": parseo["ok"],
                "error": parseo["error"],
                "crudo": crudo,
            }
        )
    metricas = calcular_metricas(pares)
    return {"metricas": metricas, "predicciones": detalle}


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos del harness."""
    parser = argparse.ArgumentParser(description="Evalúa la extracción de órdenes.")
    parser.add_argument("--proveedor", choices=("base", "lora", "xai"), required=True)
    parser.add_argument(
        "--test",
        type=Path,
        default=_RAIZ / "data" / "ordenes" / "test.jsonl",
    )
    parser.add_argument(
        "--adapter",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v1",
    )
    parser.add_argument("--modelo", default=MODELO_BASE)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument(
        "--limite",
        type=int,
        default=0,
        help="0 evalúa el test completo.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Escribe JSON + tabla markdown. Sin clave xAI sale 0."""
    args = parser_cli().parse_args(argv)
    filas = leer_jsonl(args.test)
    if args.limite > 0:
        filas = filas[: args.limite]
    if args.proveedor == "xai":
        if not clave_xai():
            print("Sin XAI_API_KEY: se omite el proveedor xai. No es un error de gate.")
            return 0

        def completar(fila: dict) -> str:
            return completar_xai(construir_mensajes(fila, False))

    else:
        modelo, tokenizer = _cargar_local(args.proveedor, args.adapter, args.modelo)

        def completar(fila: dict) -> str:
            return _generar_local(modelo, tokenizer, fila)

    resultado = evaluar_filas(filas, completar)
    resultado["proveedor"] = args.proveedor
    resultado["modelo"] = args.modelo
    resultado["n"] = len(filas)
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    tabla = tabla_markdown(resultado["metricas"], f"proveedor {args.proveedor}")
    markdown = args.salida.with_suffix(".md")
    markdown.write_text(tabla + "\n", encoding="utf-8", newline="\n")
    print(tabla)
    print(f"json: {args.salida}")
    return 0
