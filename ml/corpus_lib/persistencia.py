"""Escritura JSONL (--sin-bd) y upsert en PostgreSQL + pgvector."""

from __future__ import annotations

import json
import os
from collections.abc import Sequence
from datetime import date, datetime
from pathlib import Path
from typing import Any

from corpus_lib.constantes import CAMPOS_CHUNK_JSONL, DATABASE_URL_DEFAULT
from corpus_lib.modelos import Chunk, Fuente


def fila_jsonl(
    fuente: Fuente,
    chunk: Chunk,
    embedding: Sequence[float],
    *,
    hash_sha256: str,
    fecha_descarga: str,
    url: str,
) -> dict[str, Any]:
    """Arma un registro JSONL con metadatos completos."""
    return {
        "fuente_id": fuente.id,
        "titulo": fuente.titulo,
        "fuente": fuente.id,
        "tipo": fuente.tipo,
        "url": url,
        "fecha_descarga": fecha_descarga,
        "hash_sha256": hash_sha256,
        "vigencia": fuente.vigencia,
        "ref": chunk.ref,
        "texto": chunk.texto,
        "metadatos": chunk.metadatos,
        "embedding": list(embedding),
    }


def validar_fila_jsonl(fila: dict[str, Any]) -> None:
    """Comprueba que el registro trae todos los campos exigidos."""
    faltan = [c for c in CAMPOS_CHUNK_JSONL if c not in fila]
    if faltan:
        raise ValueError(f"JSONL incompleto, faltan {faltan}")


def escribir_jsonl(ruta: Path, filas: list[dict[str, Any]]) -> None:
    """Escribe corpus/cache/chunks.jsonl en UTF-8 sin BOM."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="\n") as fh:
        for fila in filas:
            validar_fila_jsonl(fila)
            fh.write(json.dumps(fila, ensure_ascii=False) + "\n")


def _fecha_sql(fecha: str) -> date:
    if not fecha:
        return date.today()
    try:
        return date.fromisoformat(fecha[:10])
    except ValueError:
        return datetime.now().date()


def upsert_en_bd(
    filas: list[dict[str, Any]],
    dsn: str | None = None,
) -> int:
    """Inserta documentos y chunks. Borra chunks previos si el hash cambió.

    Si el hash coincide, no reescribe. `tsv` es columna generada: no se
    inserta. Devuelve el número de chunks insertados.
    """
    import psycopg
    from pgvector.psycopg import register_vector
    from psycopg.types.json import Jsonb

    url = dsn or os.environ.get("DATABASE_URL", DATABASE_URL_DEFAULT)
    insertados = 0
    with psycopg.connect(url) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            por_fuente: dict[str, list[dict[str, Any]]] = {}
            for fila in filas:
                por_fuente.setdefault(fila["fuente"], []).append(fila)

            for fuente_id, grupo in por_fuente.items():
                cabeza = grupo[0]
                cur.execute(
                    "SELECT id, hash_sha256 FROM documentos "
                    "WHERE fuente = %s ORDER BY id DESC LIMIT 1",
                    (fuente_id,),
                )
                row = cur.fetchone()
                hash_nuevo = cabeza["hash_sha256"]
                if row and row[1] == hash_nuevo:
                    continue
                if row:
                    doc_id = row[0]
                    cur.execute(
                        "DELETE FROM chunks WHERE documento_id = %s",
                        (doc_id,),
                    )
                    cur.execute(
                        """
                        UPDATE documentos
                           SET titulo = %s,
                               tipo = %s,
                               url = %s,
                               fecha_descarga = %s,
                               hash_sha256 = %s,
                               vigencia = %s
                         WHERE id = %s
                        """,
                        (
                            cabeza["titulo"],
                            cabeza["tipo"],
                            cabeza["url"],
                            _fecha_sql(cabeza["fecha_descarga"]),
                            hash_nuevo,
                            cabeza["vigencia"],
                            doc_id,
                        ),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO documentos (
                            titulo, fuente, tipo, url,
                            fecha_descarga, hash_sha256, vigencia
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            cabeza["titulo"],
                            cabeza["fuente"],
                            cabeza["tipo"],
                            cabeza["url"],
                            _fecha_sql(cabeza["fecha_descarga"]),
                            hash_nuevo,
                            cabeza["vigencia"],
                        ),
                    )
                    doc_id = cur.fetchone()[0]

                for fila in grupo:
                    cur.execute(
                        """
                        INSERT INTO chunks (
                            documento_id, ref, texto, metadatos, embedding
                        ) VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            doc_id,
                            fila["ref"],
                            fila["texto"],
                            Jsonb(fila["metadatos"]),
                            fila["embedding"],
                        ),
                    )
                    insertados += 1
        conn.commit()
    return insertados
