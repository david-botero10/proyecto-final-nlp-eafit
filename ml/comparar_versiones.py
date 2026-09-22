"""CLI delgado: compara base, LoRA v1 y DPO v2."""

from __future__ import annotations

import sys

from dpo.comparar import main

if __name__ == "__main__":
    sys.exit(main())
