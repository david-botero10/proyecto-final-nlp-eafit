"""Modelos de dominio del corpus."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Fuente:
    """Entrada de corpus/fuentes.json."""

    id: str
    titulo: str
    tipo: str
    url: str
    formato: str
    vigencia: str


@dataclass
class Chunk:
    """Fragmento listo para embeber e indexar."""

    fuente_id: str
    ref: str
    texto: str
    metadatos: dict[str, Any] = field(default_factory=dict)
