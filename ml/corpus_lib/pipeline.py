"""Orquestación descarga → parseo → chunking → embeddings → persistencia."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from corpus_lib.chunking import chunkear_cartilla, chunkear_ley
from corpus_lib.constantes import DIM_EMBEDDING
from corpus_lib.descarga import descargar_fuentes, extension_fuente, ruta_crudo
from corpus_lib.fuentes import cargar_fuentes
from corpus_lib.modelos import Chunk, Fuente
from corpus_lib.parseo import extraer_paginas_pdf, extraer_texto_html
from corpus_lib.persistencia import escribir_jsonl, fila_jsonl, upsert_en_bd

CalcularEmbeddings = Callable[[list[str]], list[list[float]]]


def rutas_corpus(raiz: Path) -> dict[str, Path]:
    """Rutas del corpus relativas a la raíz del repo."""
    corpus = raiz / "corpus"
    return {
        "corpus": corpus,
        "fuentes": corpus / "fuentes.json",
        "raw": corpus / "raw",
        "manifiesto": corpus / "raw" / "manifiesto.json",
        "cache": corpus / "cache",
        "jsonl": corpus / "cache" / "chunks.jsonl",
    }


def _chunks_de_fuente(fuente: Fuente, path: Path) -> list[Chunk]:
    if fuente.formato == "pdf":
        paginas = extraer_paginas_pdf(path)
        return chunkear_cartilla(paginas, fuente.id)
    html = path.read_bytes()
    texto = extraer_texto_html(html)
    return chunkear_ley(texto, fuente.id)


def _fecha_y_url(
    entrada: dict[str, Any] | None, fuente: Fuente
) -> tuple[str, str]:
    if not entrada:
        return "", fuente.url
    return str(entrada.get("fecha", "")), str(entrada.get("url", fuente.url))


def indexar(
    raiz: Path,
    *,
    solo_descarga: bool = False,
    desde_cache: bool = False,
    forzar: bool = False,
    sin_bd: bool = False,
    limit: int | None = None,
    calcular_embeddings: CalcularEmbeddings | None = None,
) -> dict[str, Any]:
    """Ejecuta el pipeline. Devuelve estadísticas para el CLI y los tests."""
    r = rutas_corpus(raiz)
    fuentes = cargar_fuentes(r["fuentes"])
    manifiesto = descargar_fuentes(
        fuentes,
        r["raw"],
        r["manifiesto"],
        forzar=forzar,
        desde_cache=desde_cache,
    )
    por_id = {e["id"]: e for e in manifiesto}

    stats: dict[str, Any] = {
        "documentos": len(fuentes),
        "descargados": len(manifiesto),
        "chunks": 0,
        "jsonl": None,
        "insertados_bd": 0,
    }
    if solo_descarga:
        return stats

    pares: list[tuple[Fuente, Chunk]] = []
    for fuente in fuentes:
        path = ruta_crudo(r["raw"], fuente)
        if not path.exists():
            alt = r["raw"] / f"{fuente.id}.{extension_fuente(fuente)}"
            raise FileNotFoundError(f"no está el crudo de {fuente.id}: {alt}")
        for ch in _chunks_de_fuente(fuente, path):
            pares.append((fuente, ch))

    if limit is not None:
        pares = pares[: max(0, limit)]

    textos = [ch.texto for _, ch in pares]
    if calcular_embeddings is None:
        from corpus_lib.embeddings import calcular_embeddings as _real

        calcular_embeddings = _real
    vecs = calcular_embeddings(textos) if textos else []
    if len(vecs) != len(pares):
        raise RuntimeError(
            f"embeddings ({len(vecs)}) != chunks ({len(pares)})"
        )

    filas: list[dict[str, Any]] = []
    for (fuente, ch), vec in zip(pares, vecs, strict=True):
        if len(vec) != DIM_EMBEDDING:
            raise RuntimeError(
                f"embedding de dim {len(vec)}, se esperaba {DIM_EMBEDDING}"
            )
        entrada = por_id.get(fuente.id)
        fecha, url = _fecha_y_url(entrada, fuente)
        hash_doc = entrada["sha256"] if entrada else ""
        filas.append(
            fila_jsonl(
                fuente,
                ch,
                vec,
                hash_sha256=hash_doc,
                fecha_descarga=fecha,
                url=url,
            )
        )

    stats["chunks"] = len(filas)
    if sin_bd:
        escribir_jsonl(r["jsonl"], filas)
        stats["jsonl"] = str(r["jsonl"])
        return stats

    stats["insertados_bd"] = upsert_en_bd(filas)
    return stats
