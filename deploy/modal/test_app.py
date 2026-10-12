"""Pruebas locales de deploy/modal/app.py sin cuenta de Modal ni modelos."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "ml"))

TOKEN = "token-de-prueba"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture(scope="module")
def modulo():
    spec = importlib.util.spec_from_file_location(
        "relevo_modal_app", Path(__file__).with_name("app.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # no contacta a Modal
    return mod


@pytest.fixture(autouse=True)
def _token(monkeypatch):
    monkeypatch.setenv("MODELOS_TOKEN", TOKEN)


@pytest.fixture
def embeddings(modulo, monkeypatch):
    import servir

    monkeypatch.setattr(
        servir,
        "calcular_embeddings",
        lambda textos: [[0.5] * 1024 for _ in textos],
    )

    def sin_reranker():
        raise FileNotFoundError("BAAI/bge-reranker-v2-m3")

    monkeypatch.setattr(servir, "_cargar_reranker", sin_reranker)
    return TestClient(modulo.construir_app_embeddings())


def test_definiciones_modal(modulo):
    assert modulo.app.name == "relevo-modelos"
    assert modulo.GPU_EXTRACTOR in {"T4", "L4"}


def test_salud_sin_token(embeddings):
    r = embeddings.get("/salud")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


@pytest.mark.parametrize(
    "ruta,cuerpo",
    [
        ("/embed", {"textos": ["hola"]}),
        ("/rerank", {"consulta": "q", "textos": ["a"]}),
    ],
)
def test_embeddings_exige_token(embeddings, ruta, cuerpo):
    assert embeddings.post(ruta, json=cuerpo).status_code == 401
    mal = {"Authorization": "Bearer otro"}
    assert embeddings.post(ruta, json=cuerpo, headers=mal).status_code == 401


def test_embed_contrato(embeddings):
    r = embeddings.post("/embed", json={"textos": ["a", "b"]}, headers=AUTH)
    assert r.status_code == 200
    vectores = r.json()["vectores"]
    assert len(vectores) == 2 and len(vectores[0]) == 1024


def test_rerank_501_sin_modelo(embeddings):
    r = embeddings.post(
        "/rerank", json={"consulta": "q", "textos": ["a"]}, headers=AUTH
    )
    assert r.status_code == 501


def test_rerank_ok_y_vacio(modulo, monkeypatch):
    import servir

    class Falso:
        def compute_score(self, pares, normalize=True):
            return [0.9 - 0.1 * i for i, _ in enumerate(pares)]

    monkeypatch.setattr(servir, "_cargar_reranker", lambda: Falso())
    c = TestClient(modulo.construir_app_embeddings())
    r = c.post("/rerank", json={"consulta": "q", "textos": ["a", "b"]}, headers=AUTH)
    assert r.json() == {"scores": [0.9, 0.8]}
    r = c.post("/rerank", json={"consulta": "q", "textos": []}, headers=AUTH)
    assert r.json() == {"scores": []}


def _extractor(modulo):
    crudo = (
        '{"empleado": "Ana", "turno": "N", "fechas": ["2026-10-13"],'
        ' "justificacion": null, "accion": "asignar"}'
    )
    llamadas = []

    def completar(orden, fecha):
        llamadas.append((orden, fecha))
        return crudo

    return TestClient(modulo.construir_app_extractor(completar)), llamadas


def test_extractor_salud_sin_token(modulo):
    c, _ = _extractor(modulo)
    r = c.get("/salud")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "version": "v2"}


def test_extractor_exige_token(modulo):
    c, llamadas = _extractor(modulo)
    cuerpo = {"orden": "Ana falta mañana", "fecha_referencia": "2026-10-12"}
    assert c.post("/extraer", json=cuerpo).status_code == 401
    assert llamadas == []


def test_extractor_contrato(modulo):
    c, llamadas = _extractor(modulo)
    cuerpo = {"orden": "Ana falta mañana", "fecha_referencia": "2026-10-12"}
    r = c.post("/extraer", json=cuerpo, headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {
        "empleado": "Ana",
        "turno": "N",
        "fechas": ["2026-10-13"],
        "justificacion": None,
        "accion": "asignar",
    }
    assert llamadas == [("Ana falta mañana", "2026-10-12")]
    bad = {"orden": "x", "fecha_referencia": "no-fecha"}
    assert c.post("/extraer", json=bad, headers=AUTH).status_code == 422


def test_falla_cerrado_sin_token_configurado(modulo, monkeypatch):
    monkeypatch.delenv("MODELOS_TOKEN")
    c, _ = _extractor(modulo)
    cuerpo = {"orden": "x", "fecha_referencia": "2026-10-12"}
    assert c.post("/extraer", json=cuerpo, headers=AUTH).status_code == 401
    assert c.get("/salud").status_code == 200
