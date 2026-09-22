"""CLI delgado: evalúa base, LoRA o xAI sobre el test set."""

from __future__ import annotations

import sys

from extractor.evaluar import main

if __name__ == "__main__":
    sys.exit(main())
