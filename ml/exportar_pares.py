"""CLI delgado: exporta pares_preferencia a JSONL DPO."""

from __future__ import annotations

import sys

from dpo.pares import main

if __name__ == "__main__":
    sys.exit(main())
