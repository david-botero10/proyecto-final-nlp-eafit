"""CLI del pipeline de indexación del corpus normativo de Relevo."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _raiz_repo() -> Path:
    return Path(__file__).resolve().parent.parent


def construir_parser() -> argparse.ArgumentParser:
    """Flags documentados en docs/orca/A3_CORPUS_SPEC.md."""
    parser = argparse.ArgumentParser(
        description=(
            "Descarga, parte y embebe el corpus normativo colombiano "
            "(bge-m3 → pgvector)."
        )
    )
    parser.add_argument(
        "--solo-descarga",
        action="store_true",
        help="Solo descarga a corpus/raw y escribe el manifiesto.",
    )
    parser.add_argument(
        "--desde-cache",
        action="store_true",
        help="No redescarga; usa los archivos ya presentes en corpus/raw.",
    )
    parser.add_argument(
        "--forzar",
        action="store_true",
        help="Invalida el hash del manifiesto y vuelve a descargar.",
    )
    parser.add_argument(
        "--sin-bd",
        action="store_true",
        help="Escribe corpus/cache/chunks.jsonl en vez de upsert a PostgreSQL.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Procesa solo N chunks (pruebas).",
    )
    return parser


def main(argv: list[str] | None = None, raiz: Path | None = None) -> int:
    """Punto de entrada. `raiz` es inyectable en tests."""
    args = construir_parser().parse_args(argv)
    # Import local para que `python ml/indexar.py` encuentre corpus_lib.
    from corpus_lib.pipeline import indexar

    stats = indexar(
        raiz or _raiz_repo(),
        solo_descarga=args.solo_descarga,
        desde_cache=args.desde_cache,
        forzar=args.forzar,
        sin_bd=args.sin_bd,
        limit=args.limit,
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
