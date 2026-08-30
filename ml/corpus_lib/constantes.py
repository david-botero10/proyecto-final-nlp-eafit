"""Constantes del pipeline de indexación."""

from __future__ import annotations

DATABASE_URL_DEFAULT = "postgresql://relevo:relevo@localhost:5432/relevo"
DIM_EMBEDDING = 1024
MAX_TOKENS_ARTICULO = 1200
MAX_TOKENS_CARTILLA = 800
MIN_TOKENS_CARTILLA = 500
MODELO_BGE = "BAAI/bge-m3"
SOLAPE_TOKENS = 100
TAMANO_LOTE_EMBED = 16
USER_AGENT = (
    "Mozilla/5.0 (compatible; RelevoCorpusIndexer/1.0; EAFIT NLP 2026)"
)

CAMPOS_CHUNK_JSONL = (
    "fuente_id",
    "titulo",
    "fuente",
    "tipo",
    "url",
    "fecha_descarga",
    "hash_sha256",
    "vigencia",
    "ref",
    "texto",
    "metadatos",
    "embedding",
)
