"""El dataset dorado de citas se puede parsear y no trae refs vacías."""

from __future__ import annotations

import json
import re
from pathlib import Path

_DORADO = Path(__file__).resolve().parents[2] / "evaluacion" / "citas_doradas.jsonl"
_REF = re.compile(r"^art\. \d+$")


def test_citas_doradas_validas() -> None:
    lineas = [
        linea
        for linea in _DORADO.read_text(encoding="utf-8").splitlines()
        if linea.strip()
    ]
    assert len(lineas) == 20
    ids: set[str] = set()
    for linea in lineas:
        fila = json.loads(linea)
        assert isinstance(fila["id"], str) and fila["id"]
        assert fila["id"] not in ids
        ids.add(fila["id"])
        assert isinstance(fila["pregunta"], str) and fila["pregunta"].strip()
        refs = fila["refs_esperadas"]
        assert isinstance(refs, list) and refs
        assert all(isinstance(ref, str) and _REF.match(ref) for ref in refs)
