"""--sin-bd escribe JSONL válido con metadatos completos (embeddings simulados)."""

from __future__ import annotations

import json
from pathlib import Path

from html_senado import HTML_TRES_ARTICULOS

from corpus_lib.constantes import CAMPOS_CHUNK_JSONL, DIM_EMBEDDING
from corpus_lib.descarga import sha256_bytes
from corpus_lib.pipeline import indexar


def _embeddings_falsos(textos: list[str]) -> list[list[float]]:
    """Vectores unitarios de 1024 d; no carga bge-m3."""
    vecs: list[list[float]] = []
    for i, _ in enumerate(textos):
        v = [0.0] * DIM_EMBEDDING
        v[i % DIM_EMBEDDING] = 1.0
        vecs.append(v)
    return vecs


def test_sin_bd_jsonl_metadatos_completos(tmp_path: Path):
    corpus = tmp_path / "corpus"
    raw = corpus / "raw"
    raw.mkdir(parents=True)
    html = HTML_TRES_ARTICULOS.encode("utf-8")
    (raw / "cst_recorte.html").write_bytes(html)
    fuentes = [
        {
            "id": "cst_recorte",
            "titulo": "CST recorte de prueba",
            "tipo": "ley",
            "url": "http://ejemplo.test/cst_recorte.html",
            "formato": "html",
            "vigencia": "fixture de test, no vigente",
        }
    ]
    (corpus / "fuentes.json").write_text(
        json.dumps(fuentes, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    manifiesto = [
        {
            "id": "cst_recorte",
            "url": "http://ejemplo.test/cst_recorte.html",
            "sha256": sha256_bytes(html),
            "bytes": len(html),
            "fecha": "2026-08-30T12:00:00+00:00",
        }
    ]
    (raw / "manifiesto.json").write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    stats = indexar(
        tmp_path,
        desde_cache=True,
        sin_bd=True,
        calcular_embeddings=_embeddings_falsos,
    )
    assert stats["chunks"] == 3
    jsonl = Path(stats["jsonl"])
    assert jsonl.exists()
    filas = [
        json.loads(ln)
        for ln in jsonl.read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    assert len(filas) == 3
    assert [f["ref"] for f in filas] == ["art. 22", "art. 23", "art. 29"]
    for fila in filas:
        for campo in CAMPOS_CHUNK_JSONL:
            assert campo in fila, campo
        assert len(fila["embedding"]) == DIM_EMBEDDING
        assert fila["tipo"] == "ley"
        assert fila["fuente_id"] == "cst_recorte"
        assert fila["hash_sha256"] == sha256_bytes(html)
        assert fila["vigencia"]
        assert fila["texto"]
        assert "capitulo" in fila["metadatos"]


def test_limit_recorta_chunks(tmp_path: Path):
    corpus = tmp_path / "corpus"
    raw = corpus / "raw"
    raw.mkdir(parents=True)
    html = HTML_TRES_ARTICULOS.encode("utf-8")
    (raw / "cst_recorte.html").write_bytes(html)
    (corpus / "fuentes.json").write_text(
        json.dumps(
            [
                {
                    "id": "cst_recorte",
                    "titulo": "CST recorte",
                    "tipo": "ley",
                    "url": "http://ejemplo.test/x",
                    "formato": "html",
                    "vigencia": "test",
                }
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (raw / "manifiesto.json").write_text(
        json.dumps(
            [
                {
                    "id": "cst_recorte",
                    "url": "http://ejemplo.test/x",
                    "sha256": sha256_bytes(html),
                    "bytes": len(html),
                    "fecha": "2026-08-30T12:00:00+00:00",
                }
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    stats = indexar(
        tmp_path,
        desde_cache=True,
        sin_bd=True,
        limit=1,
        calcular_embeddings=_embeddings_falsos,
    )
    assert stats["chunks"] == 1
