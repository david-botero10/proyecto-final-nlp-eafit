"""Servicio FastAPI del extractor afinado. GPU si hay, CPU si no."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from extractor.constantes import MODELO_BASE
from extractor.parser import parsear_extraccion

_RAIZ = Path(__file__).resolve().parents[1]


class _Estado:
    """Modelo cargado una sola vez, en la primera orden."""

    modelo = None
    tokenizer = None
    version = "v1"
    adapter: Path | None = None
    modelo_id = MODELO_BASE


_estado = _Estado()


class EntradaExtraer(BaseModel):
    """Cuerpo de POST /extraer."""

    orden: str
    fecha_referencia: str


def resolver_adapter(explicito: Path | None, raiz: Path = _RAIZ) -> tuple[Path, str]:
    """v2 si el adapter existe; si no, v1. Una ruta explícita manda."""
    v2 = raiz / "ml" / "models" / "extractor-v2"
    v1 = raiz / "ml" / "models" / "extractor-v1"
    if explicito is not None:
        ruta = explicito
    elif (v2 / "adapter_config.json").is_file():
        ruta = v2
    else:
        ruta = v1
    if ruta.resolve() == v2.resolve():
        version = "v2"
    elif ruta.resolve() == v1.resolve():
        version = "v1"
    else:
        version = ruta.name
    return ruta, version


def _cargar() -> None:
    from peft import PeftModel

    from extractor.modelo import cargar_para_servicio

    if _estado.adapter is None:
        raise RuntimeError("no hay adapter configurado")
    modelo, tokenizer = cargar_para_servicio(_estado.modelo_id)
    modelo = PeftModel.from_pretrained(modelo, str(_estado.adapter))
    modelo.eval()
    _estado.modelo = modelo
    _estado.tokenizer = tokenizer


def _completar_modelo(orden: str, fecha_referencia: str) -> str:
    from extractor.evaluar import generar_extraccion

    if _estado.modelo is None:
        _cargar()
    fila = {"orden": orden, "fecha_referencia": fecha_referencia}
    return generar_extraccion(_estado.modelo, _estado.tokenizer, fila)


def crear_app(completar=None, version: str = "v1") -> FastAPI:
    """App con el contrato de extracción. `completar` evita cargar el modelo."""
    app = FastAPI(title="Relevo extractor")

    @app.get("/salud")
    def salud() -> dict:
        return {"ok": True, "version": version}

    @app.post("/extraer")
    def extraer(cuerpo: EntradaExtraer) -> dict:
        if not cuerpo.orden.strip():
            raise HTTPException(status_code=422, detail="orden vacía")
        try:
            date.fromisoformat(cuerpo.fecha_referencia)
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail="fecha_referencia inválida"
            ) from exc
        if completar is None:
            crudo = _completar_modelo(cuerpo.orden, cuerpo.fecha_referencia)
        else:
            crudo = completar(cuerpo.orden, cuerpo.fecha_referencia)
        parseo = parsear_extraccion(crudo)
        if not parseo["ok"] or parseo["valor"] is None:
            raise HTTPException(
                status_code=422,
                detail="la orden no produjo una extracción",
            )
        return parseo["valor"]

    return app


def puerto_defecto() -> int:
    """EXTRACTOR_PORT o 8642."""
    return int(os.environ.get("EXTRACTOR_PORT", "8642"))


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos del servicio."""
    parser = argparse.ArgumentParser(description="Sirve el extractor afinado.")
    parser.add_argument("--adapter", type=Path, default=None)
    parser.add_argument("--modelo", default=MODELO_BASE)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Levanta uvicorn. Falla si el adapter no está en disco."""
    args = parser_cli().parse_args(argv)
    ruta, version = resolver_adapter(args.adapter)
    if not (ruta / "adapter_config.json").is_file():
        print(f"no está el adapter: {ruta}", file=sys.stderr)
        return 1
    _estado.adapter = ruta
    _estado.version = version
    _estado.modelo_id = args.modelo
    import uvicorn

    uvicorn.run(
        crear_app(version=version),
        host=args.host,
        port=args.port if args.port is not None else puerto_defecto(),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
