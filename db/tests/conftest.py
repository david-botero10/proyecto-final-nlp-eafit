"""Fixtures de conexión.

Si no hay PostgreSQL, se omite la suite con un mensaje claro.
"""

from __future__ import annotations

import os

import psycopg
import pytest

DATABASE_URL_DEFAULT = "postgresql://relevo:relevo@localhost:5432/relevo"


@pytest.fixture(scope="session")
def db_url() -> str:
    """URL de la base local (o DATABASE_URL)."""
    return os.environ.get("DATABASE_URL", DATABASE_URL_DEFAULT)


@pytest.fixture(scope="session")
def conn(db_url: str):
    """Conexión autocommit. pytest.skip si el compose no está arriba."""
    try:
        conexion = psycopg.connect(db_url, autocommit=True)
        conexion.execute("SELECT 1")
    except psycopg.Error as exc:
        pytest.skip(
            f"Sin conexión a PostgreSQL ({exc}). "
            "Levanta la base con `docker compose up -d db` y vuelve a correr pytest."
        )
    yield conexion
    conexion.close()
