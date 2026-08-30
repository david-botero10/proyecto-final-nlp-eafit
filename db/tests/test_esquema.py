"""Pruebas del esquema, migraciones, seed y roles contra la BD del compose."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psycopg
import pytest

ROOT = Path(__file__).resolve().parents[2]
MIGRATE = ROOT / "db" / "migrate.py"

MIGRACIONES = [
    "0001_extensiones.sql",
    "0002_nomina.sql",
    "0003_gobernanza.sql",
    "0004_corpus.sql",
    "0005_roles.sql",
]

TABLAS = [
    "turnos",
    "empleados",
    "asignaciones",
    "ausencias",
    "propuestas",
    "aprobaciones",
    "pares_preferencia",
    "perfiles",
    "conversaciones",
    "mensajes",
    "documentos",
    "chunks",
    "schema_migrations",
]


def test_migraciones_aplican_de_cero(conn: psycopg.Connection) -> None:
    """Tras migrate, están las 5 migraciones y las tablas de la arquitectura."""
    aplicadas = {
        fila[0]
        for fila in conn.execute("SELECT nombre FROM schema_migrations").fetchall()
    }
    assert set(MIGRACIONES) <= aplicadas

    existentes = {
        fila[0]
        for fila in conn.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            """
        ).fetchall()
    }
    faltan = [t for t in TABLAS if t not in existentes]
    assert faltan == []

    dim = conn.execute(
        """
        SELECT atttypmod
        FROM pg_attribute
        WHERE attrelid = 'chunks'::regclass
          AND attname = 'embedding'
        """
    ).fetchone()
    assert dim is not None
    # pgvector guarda la dimensión en atttypmod.
    assert dim[0] == 1024


def test_reaplicar_es_noop(conn: psycopg.Connection, db_url: str) -> None:
    """Volver a correr migrate.py no inserta filas nuevas en schema_migrations."""
    antes = conn.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0]
    env = {**os.environ, "DATABASE_URL": db_url}
    resultado = subprocess.run(
        [sys.executable, str(MIGRATE)],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    )
    despues = conn.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0]
    assert despues == antes
    assert "aplicada " not in resultado.stdout
    assert "omitida " in resultado.stdout


def test_seed_conteos(conn: psycopg.Connection) -> None:
    """El seed deja los conteos del dataset sintético."""
    n_turnos = conn.execute("SELECT COUNT(*) FROM turnos").fetchone()[0]
    n_empleados = conn.execute("SELECT COUNT(*) FROM empleados").fetchone()[0]
    n_ausencias = conn.execute("SELECT COUNT(*) FROM ausencias").fetchone()[0]
    n_asignaciones = conn.execute("SELECT COUNT(*) FROM asignaciones").fetchone()[0]
    assert n_turnos == 3
    assert n_empleados == 40
    assert n_ausencias == 30
    assert n_asignaciones == 1837

    equipos = dict(
        conn.execute(
            "SELECT equipo, COUNT(*) FROM empleados GROUP BY equipo"
        ).fetchall()
    )
    assert equipos == {"enfermeria": 20, "recepcion": 10, "vigilancia": 10}

    sin_turno = conn.execute(
        """
        SELECT COUNT(*) FROM empleados e
        WHERE NOT EXISTS (
            SELECT 1 FROM asignaciones a WHERE a.empleado_id = e.id
        )
        """
    ).fetchone()[0]
    assert sin_turno == 0

    codigos = {
        fila[0] for fila in conn.execute("SELECT codigo FROM turnos").fetchall()
    }
    assert codigos == {"M", "T", "N"}
    noche = conn.execute(
        "SELECT cruza_medianoche FROM turnos WHERE codigo = 'N'"
    ).fetchone()[0]
    assert noche is True


def test_unique_asignaciones_rechaza_duplicados(conn: psycopg.Connection) -> None:
    """UNIQUE (empleado_id, fecha, turno_id) rechaza un duplicado del seed."""
    fila = conn.execute(
        "SELECT empleado_id, turno_id, fecha FROM asignaciones LIMIT 1"
    ).fetchone()
    assert fila is not None
    with pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute(
            """
            INSERT INTO asignaciones (
                empleado_id, turno_id, fecha, estado, origen
            )
            VALUES (%s, %s, %s, 'programada', 'seed')
            """,
            fila,
        )


def test_consulta_solapes_devuelve_cero(conn: psycopg.Connection) -> None:
    """Nadie tiene asignación activa en un día de ausencia aprobada, ni dos turnos."""
    solapes_ausencia = conn.execute(
        """
        SELECT COUNT(*)
        FROM asignaciones a
        JOIN ausencias u ON u.empleado_id = a.empleado_id
        WHERE u.estado = 'aprobada'
          AND a.estado <> 'cancelada'
          AND a.fecha BETWEEN u.fecha_inicio AND u.fecha_fin
        """
    ).fetchone()[0]
    assert solapes_ausencia == 0

    solapes_turno = conn.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT empleado_id, fecha
            FROM asignaciones
            WHERE estado <> 'cancelada'
            GROUP BY empleado_id, fecha
            HAVING COUNT(*) > 1
        ) s
        """
    ).fetchone()[0]
    assert solapes_turno == 0


def test_roles_lector_no_puede_insertar(conn: psycopg.Connection) -> None:
    """Existen los roles y relevo_lector no puede insertar en nómina."""
    roles = {
        fila[0]
        for fila in conn.execute(
            """
            SELECT rolname FROM pg_roles
            WHERE rolname IN ('relevo_lector', 'relevo_escritor')
            """
        ).fetchall()
    }
    assert roles == {"relevo_lector", "relevo_escritor"}

    conn.execute("SET ROLE relevo_lector")
    try:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(
                """
                INSERT INTO empleados (
                    nombre, documento, rol, equipo, fecha_ingreso, activo
                )
                VALUES (
                    'No Debe Insertar', '0000000000', 'prueba',
                    'recepcion', '2026-01-01', TRUE
                )
                """
            )
    finally:
        conn.execute("RESET ROLE")
