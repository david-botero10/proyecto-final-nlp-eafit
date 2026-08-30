"""Embeddings densos bge-m3 (CPU, normalizados, lote 16)."""

from __future__ import annotations

from typing import Any

import numpy as np

from corpus_lib.constantes import (
    DIM_EMBEDDING,
    MODELO_BGE,
    TAMANO_LOTE_EMBED,
)

_modelo: Any | None = None


def _cargar_modelo() -> Any:
    """Carga perezosa de BGEM3FlagModel en CPU; caché HF estándar."""
    global _modelo
    if _modelo is None:
        from FlagEmbedding import BGEM3FlagModel

        try:
            _modelo = BGEM3FlagModel(
                MODELO_BGE,
                use_fp16=False,
                devices="cpu",
                normalize_embeddings=True,
            )
        except TypeError:
            try:
                _modelo = BGEM3FlagModel(
                    MODELO_BGE, use_fp16=False, device="cpu"
                )
            except TypeError:
                _modelo = BGEM3FlagModel(MODELO_BGE, use_fp16=False)
    return _modelo


def _normalizar(vecs: np.ndarray) -> np.ndarray:
    normas = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / np.clip(normas, 1e-12, None)


def calcular_embeddings(textos: list[str]) -> list[list[float]]:
    """Devuelve vectores densos L2-normalizados de 1024 dimensiones.

    No se piden sparse ni colbert. El modelo vive en el caché de
    Hugging Face por defecto.
    """
    if not textos:
        return []
    modelo = _cargar_modelo()
    kwargs = {
        "batch_size": TAMANO_LOTE_EMBED,
        "max_length": 8192,
    }
    try:
        salida = modelo.encode(
            textos,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
            **kwargs,
        )
    except TypeError:
        salida = modelo.encode(textos, **kwargs)

    if isinstance(salida, dict):
        densos = salida.get("dense_vecs", salida.get("dense"))
    else:
        densos = salida
    arr = np.asarray(densos, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    if arr.shape[1] != DIM_EMBEDDING:
        raise RuntimeError(
            f"bge-m3 devolvió dim {arr.shape[1]}, se esperaba {DIM_EMBEDDING}"
        )
    return _normalizar(arr).tolist()
