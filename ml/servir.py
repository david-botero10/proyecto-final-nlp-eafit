"""Servicio HTTP de embeddings bge-m3 y re-ranking (CPU)."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from corpus_lib.embeddings import calcular_embeddings

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")

MODELO_RERANK = "BAAI/bge-reranker-v2-m3"
_reranker: Any | None = None

app = FastAPI(title="Relevo embed")


class EmbedEntrada(BaseModel):
    textos: list[str] = Field(default_factory=list)


class EmbedSalida(BaseModel):
    vectores: list[list[float]]


class RerankEntrada(BaseModel):
    consulta: str
    textos: list[str] = Field(default_factory=list)


class RerankSalida(BaseModel):
    scores: list[float]


def _en_cache(repo_id: str) -> bool:
    """True solo si el modelo ya está en la caché local de Hugging Face."""
    try:
        from huggingface_hub import try_to_load_from_cache
    except ImportError:
        return False
    ruta = try_to_load_from_cache(repo_id, "config.json")
    return isinstance(ruta, str)


def _cargar_reranker() -> Any:
    """Carga perezosa. No descarga: si no está en caché, falla."""
    global _reranker
    if _reranker is not None:
        return _reranker
    if not _en_cache(MODELO_RERANK):
        raise FileNotFoundError(MODELO_RERANK)
    from FlagEmbedding import FlagReranker

    try:
        modelo = FlagReranker(
            MODELO_RERANK,
            use_fp16=False,
            devices="cpu",
        )
    except TypeError:
        modelo = FlagReranker(MODELO_RERANK, use_fp16=False)
    _reranker = modelo
    return modelo


def _puntajes(modelo: Any, pares: list[list[str]]) -> list[float]:
    try:
        crudo = modelo.compute_score(pares, normalize=True)
    except TypeError:
        crudo = modelo.compute_score(pares)
    if isinstance(crudo, int | float):
        return [float(crudo)]
    return [float(punto) for punto in crudo]


@app.get("/salud")
def salud() -> dict[str, bool]:
    return {"ok": True}


@app.post("/embed", response_model=EmbedSalida)
def embed(entrada: EmbedEntrada) -> EmbedSalida:
    """Mismos parámetros que corpus_lib.embeddings.calcular_embeddings."""
    return EmbedSalida(vectores=calcular_embeddings(entrada.textos))


@app.post("/rerank", response_model=RerankSalida)
def rerank(entrada: RerankEntrada) -> RerankSalida:
    if not entrada.textos:
        return RerankSalida(scores=[])
    try:
        modelo = _cargar_reranker()
        pares = [[entrada.consulta, texto] for texto in entrada.textos]
        return RerankSalida(scores=_puntajes(modelo, pares))
    except Exception as exc:
        raise HTTPException(
            status_code=501,
            detail="El re-ranker no está disponible.",
        ) from exc
