"""Contrato HTTP del extractor con un modelo falso."""

from __future__ import annotations

from fastapi.testclient import TestClient

from extractor.prompt import serializar_respuesta
from servir_extractor import crear_app

_VALOR = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "N",
    "fechas": ["2026-08-07"],
    "justificacion": None,
    "accion": "asignar",
}


def _completar(orden: str, fecha_referencia: str) -> str:
    assert "Ana" in orden
    assert fecha_referencia == "2026-09-21"
    return serializar_respuesta(_VALOR)


def test_extraer_devuelve_el_contrato() -> None:
    with TestClient(crear_app(completar=_completar, version="mock")) as cliente:
        respuesta = cliente.post(
            "/extraer",
            json={
                "orden": "ponle el de la noche a Ana el puente",
                "fecha_referencia": "2026-09-21",
            },
        )
        assert respuesta.status_code == 200
        assert respuesta.json() == _VALOR
        salud = cliente.get("/salud")
        assert salud.status_code == 200
        assert salud.json() == {"ok": True, "version": "mock"}


def test_null_no_es_extraccion() -> None:
    def _null(orden: str, fecha_referencia: str) -> str:
        return "null"

    with TestClient(crear_app(completar=_null, version="v1")) as cliente:
        respuesta = cliente.post(
            "/extraer",
            json={"orden": "Buenas, ¿cómo va?", "fecha_referencia": "2026-09-21"},
        )
        assert respuesta.status_code == 422
        assert cliente.get("/salud").json()["ok"] is True
