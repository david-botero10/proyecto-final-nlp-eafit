"""Carga y validación de corpus/fuentes.json."""

from __future__ import annotations

import json
from pathlib import Path

from corpus_lib.modelos import Fuente

CAMPOS = ("id", "titulo", "tipo", "url", "formato", "vigencia")
TIPOS = {"ley", "cartilla"}
FORMATOS = {"html", "pdf"}


def cargar_fuentes(ruta: Path) -> list[Fuente]:
    """Lee y valida la lista de fuentes."""
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    if not isinstance(datos, list) or not datos:
        raise ValueError(f"{ruta} debe ser una lista JSON no vacía")

    fuentes: list[Fuente] = []
    vistos: set[str] = set()
    for i, raw in enumerate(datos):
        if not isinstance(raw, dict):
            raise ValueError(f"fuente #{i} no es un objeto")
        faltan = [c for c in CAMPOS if c not in raw]
        if faltan:
            raise ValueError(f"fuente #{i} sin campos {faltan}")
        if raw["tipo"] not in TIPOS:
            raise ValueError(f"tipo inválido en {raw['id']}: {raw['tipo']}")
        if raw["formato"] not in FORMATOS:
            raise ValueError(
                f"formato inválido en {raw['id']}: {raw['formato']}"
            )
        if raw["id"] in vistos:
            raise ValueError(f"id duplicado: {raw['id']}")
        vistos.add(raw["id"])
        fuentes.append(
            Fuente(
                id=str(raw["id"]),
                titulo=str(raw["titulo"]),
                tipo=str(raw["tipo"]),
                url=str(raw["url"]),
                formato=str(raw["formato"]),
                vigencia=str(raw["vigencia"]),
            )
        )
    return fuentes
