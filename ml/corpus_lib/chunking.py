"""Chunking estructural: leyes por artículo, cartillas por ventana."""

from __future__ import annotations

import re

from corpus_lib.constantes import (
    MAX_TOKENS_ARTICULO,
    MAX_TOKENS_CARTILLA,
    SOLAPE_TOKENS,
)
from corpus_lib.modelos import Chunk
from corpus_lib.tokens import partir_con_solape

_INICIO_ARTICULO = re.compile(
    r"^(?:ART[IÍ]CULO|Artículo)\s+(\d+)\s*(?:o|º|°)?\s*\.?\s*",
    re.IGNORECASE,
)
_PARTE = re.compile(r"^PARTE\s+\S+\.", re.IGNORECASE)
_TITULO = re.compile(r"^T[IÍ]TULO\s+.+\.", re.IGNORECASE)
_CAPITULO = re.compile(
    r"^CAP[IÍ]TULO\s+([IVXLCDM]+|\d+)\.",
    re.IGNORECASE,
)
_ANCLA_INDICE = re.compile(r"\d-\d")


def _es_encabezado(linea: str) -> tuple[str, str] | None:
    """Clasifica PARTE / TÍTULO / CAPÍTULO; ignora ARTÍCULO y anclas TOC."""
    s = linea.strip()
    if _INICIO_ARTICULO.match(s) or _ANCLA_INDICE.search(s):
        return None
    if _PARTE.match(s):
        return ("parte", s)
    if _TITULO.match(s):
        return ("titulo", s)
    if _CAPITULO.match(s):
        return ("capitulo", s)
    return None


def _prefijo_contexto(parte: str, titulo: str, capitulo: str) -> str:
    return " ".join(x for x in (parte, titulo, capitulo) if x)


def _partir_articulo_largo(
    fuente_id: str,
    numero: str,
    texto: str,
    metadatos: dict,
) -> list[Chunk]:
    partes = partir_con_solape(texto, MAX_TOKENS_ARTICULO, SOLAPE_TOKENS)
    chunks: list[Chunk] = []
    for i, pieza in enumerate(partes, start=1):
        ref = f"art. {numero}" if i == 1 else f"art. {numero} ({i})"
        meta = dict(metadatos)
        if len(partes) > 1:
            meta["parte_articulo"] = i
            meta["partes_articulo"] = len(partes)
        chunks.append(
            Chunk(
                fuente_id=fuente_id,
                ref=ref,
                texto=pieza,
                metadatos=meta,
            )
        )
    return chunks


def chunkear_ley(texto: str, fuente_id: str = "") -> list[Chunk]:
    """Un chunk por artículo; capítulo/título como prefijo de contexto.

    Artículos de más de 1200 tokens se parten con solape de 100.
    """
    parte = titulo = capitulo = ""
    articulos: list[dict] = []
    actual: dict | None = None

    for cruda in texto.splitlines():
        linea = cruda.strip()
        if not linea:
            continue
        encabezado = _es_encabezado(linea)
        if encabezado:
            tipo, valor = encabezado
            if tipo == "parte":
                parte = valor
            elif tipo == "titulo":
                titulo = valor
            else:
                capitulo = valor
            continue
        m = _INICIO_ARTICULO.match(linea)
        if m:
            if actual is not None:
                articulos.append(actual)
            actual = {
                "num": m.group(1),
                "parte": parte,
                "titulo": titulo,
                "capitulo": capitulo,
                "lineas": [linea],
            }
            continue
        if actual is not None:
            actual["lineas"].append(linea)

    if actual is not None:
        articulos.append(actual)

    chunks: list[Chunk] = []
    for art in articulos:
        cuerpo = "\n".join(art["lineas"]).strip()
        ctx = _prefijo_contexto(art["parte"], art["titulo"], art["capitulo"])
        texto_chunk = f"{ctx}\n{cuerpo}".strip() if ctx else cuerpo
        meta = {
            "parte": art["parte"],
            "titulo": art["titulo"],
            "capitulo": art["capitulo"],
            "articulo": art["num"],
        }
        chunks.extend(
            _partir_articulo_largo(fuente_id, art["num"], texto_chunk, meta)
        )
    return chunks


def chunkear_cartilla(
    paginas: list[tuple[int, str]],
    fuente_id: str = "",
) -> list[Chunk]:
    """Ventanas de 500–800 tokens (tamaño 800) con solape 100; ref = p. N."""
    tokens_con_pagina: list[tuple[int, str]] = []
    for numero, texto in paginas:
        for tok in texto.split():
            tokens_con_pagina.append((numero, tok))
    if not tokens_con_pagina:
        return []

    max_t = MAX_TOKENS_CARTILLA
    solape = SOLAPE_TOKENS
    chunks: list[Chunk] = []
    inicio = 0
    total = len(tokens_con_pagina)
    while inicio < total:
        fin = min(inicio + max_t, total)
        ventana = tokens_con_pagina[inicio:fin]
        pagina_ref = ventana[0][0]
        texto = " ".join(tok for _, tok in ventana)
        chunks.append(
            Chunk(
                fuente_id=fuente_id,
                ref=f"p. {pagina_ref}",
                texto=texto,
                metadatos={
                    "pagina_inicio": pagina_ref,
                    "pagina_fin": ventana[-1][0],
                    "tokens": len(ventana),
                },
            )
        )
        if fin >= total:
            break
        inicio = fin - solape
    return chunks
