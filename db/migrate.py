"""Aplica migraciones SQL pendientes sobre PostgreSQL local."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

# Credenciales locales de desarrollo (sintéticas, no son secretos).
DATABASE_URL_DEFAULT = "postgresql://relevo:relevo@localhost:5432/relevo"
MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def obtener_url() -> str:
    """Lee DATABASE_URL o el default local de desarrollo."""
    return os.environ.get("DATABASE_URL", DATABASE_URL_DEFAULT)


def es_url_local(url: str) -> bool:
    """True si el destino es localhost (único permitido para --reset)."""
    return "localhost" in url or "127.0.0.1" in url


def resetear(conn: psycopg.Connection) -> None:
    """Elimina y recrea el esquema public. No toca roles de clúster."""
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE")
        cur.execute("CREATE SCHEMA public")
        cur.execute("GRANT ALL ON SCHEMA public TO relevo")
        cur.execute("GRANT ALL ON SCHEMA public TO public")
    print("esquema public recreado")


def asegurar_tabla(conn: psycopg.Connection) -> None:
    """Crea schema_migrations si no existe."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                nombre TEXT PRIMARY KEY,
                aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )


def aplicadas(conn: psycopg.Connection) -> set[str]:
    """Nombres de migraciones ya registradas."""
    with conn.cursor() as cur:
        cur.execute("SELECT nombre FROM schema_migrations")
        return {fila[0] for fila in cur.fetchall()}


def aplicar(conn: psycopg.Connection) -> None:
    """Aplica en orden numérico cada .sql pendiente. Idempotente."""
    asegurar_tabla(conn)
    conn.commit()
    ya = aplicadas(conn)
    archivos = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not archivos:
        raise SystemExit(f"no hay migraciones en {MIGRATIONS_DIR}")
    for path in archivos:
        if path.name in ya:
            print(f"omitida {path.name}")
            continue
        sql = path.read_text(encoding="utf-8").lstrip("\ufeff")
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (nombre) VALUES (%s)",
                    (path.name,),
                )
        print(f"aplicada {path.name}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Aplica migraciones SQL de Relevo (idempotente)."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Elimina el esquema public y reaplica (solo local).",
    )
    args = parser.parse_args()
    url = obtener_url()
    if args.reset and not es_url_local(url):
        print("--reset solo está permitido contra localhost", file=sys.stderr)
        return 2
    with psycopg.connect(url) as conn:
        if args.reset:
            conn.autocommit = True
            resetear(conn)
            conn.autocommit = False
        aplicar(conn)
        conn.commit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
