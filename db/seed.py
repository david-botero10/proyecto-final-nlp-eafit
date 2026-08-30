"""Aplica los SQL de semilla de nómina en una sola transacción."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg

# Credenciales locales de desarrollo (sintéticas, no son secretos).
DATABASE_URL_DEFAULT = "postgresql://relevo:relevo@localhost:5432/relevo"
SEED_DIR = Path(__file__).resolve().parent / "seed"


def obtener_url() -> str:
    """Lee DATABASE_URL o el default local de desarrollo."""
    return os.environ.get("DATABASE_URL", DATABASE_URL_DEFAULT)


def archivos_seed() -> list[Path]:
    """SQL de semilla en orden lexicográfico (01_…, 02_…)."""
    archivos = sorted(SEED_DIR.glob("*.sql"))
    if not archivos:
        raise SystemExit(
            f"no hay SQL en {SEED_DIR}; ejecuta data/generar_dataset.py primero"
        )
    return archivos


def truncar_nomina(conn: psycopg.Connection) -> None:
    """Vacía las tablas de nómina y reinicia identidades."""
    with conn.cursor() as cur:
        cur.execute(
            "TRUNCATE TABLE ausencias, asignaciones, empleados, turnos "
            "RESTART IDENTITY CASCADE"
        )
    print("tablas de nómina truncadas")


def sembrar(conn: psycopg.Connection) -> None:
    """Ejecuta cada archivo de seed dentro de la transacción abierta."""
    with conn.cursor() as cur:
        for path in archivos_seed():
            sql = path.read_text(encoding="utf-8").lstrip("\ufeff")
            cur.execute(sql)
            print(f"sembrado {path.name}")
        cur.execute("SELECT COUNT(*) FROM turnos")
        n_turnos = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM empleados")
        n_empleados = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM asignaciones")
        n_asignaciones = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM ausencias")
        n_ausencias = cur.fetchone()[0]
    print(
        f"conteos: turnos={n_turnos} empleados={n_empleados} "
        f"asignaciones={n_asignaciones} ausencias={n_ausencias}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Siembra el dataset sintético de Relevo."
    )
    parser.add_argument(
        "--reseed",
        action="store_true",
        help="Trunca las tablas de nómina antes de sembrar.",
    )
    args = parser.parse_args()
    url = obtener_url()
    with psycopg.connect(url) as conn:
        with conn.transaction():
            if args.reseed:
                truncar_nomina(conn)
            sembrar(conn)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
