"""Añade ml/ a sys.path para importar corpus_lib desde la raíz del repo."""

from __future__ import annotations

import sys
from pathlib import Path

_ML = Path(__file__).resolve().parents[1]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))
