"""Simulador con extractor falso. No carga LoRA ni escribe en la base."""

from __future__ import annotations

import json
from pathlib import Path

from dpo.pares import escribir_jsonl
from extractor.prompt import serializar_respuesta
from ordenes.generar_ordenes import leer_jsonl
from ordenes.simular_decisiones import clasificar, decidir_fila, ordenes_nuevas

_RAIZ = Path(__file__).resolve().parents[2]

_ESPERADO = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "N",
    "fechas": ["2026-08-07"],
    "justificacion": None,
    "accion": "asignar",
}


def test_coincidencia_es_aprobacion() -> None:
    decision = clasificar(_ESPERADO, serializar_respuesta(_ESPERADO))
    assert decision["origen"] == "aprobacion"
    assert decision["elegida"] == _ESPERADO
    assert decision["rechazada"] is None


def test_diferencia_es_correccion() -> None:
    otra = {**_ESPERADO, "accion": "quitar", "turno": None}
    decision = clasificar(_ESPERADO, serializar_respuesta(otra))
    assert decision["origen"] == "correccion"
    assert decision["elegida"]["accion"] == "asignar"
    assert decision["rechazada"]["accion"] == "quitar"


def test_null_contra_null_es_aprobacion() -> None:
    assert clasificar(None, "null")["origen"] == "aprobacion"


def test_ordenes_nuevas_no_repiten_los_splits() -> None:
    nuevas = ordenes_nuevas(120, 42)
    assert nuevas == ordenes_nuevas(120, 42)
    assert len(nuevas) == 120
    ocupadas = set()
    for nombre in ("train", "val", "test"):
        ruta = _RAIZ / "data" / "ordenes" / f"{nombre}.jsonl"
        for fila in leer_jsonl(ruta):
            ocupadas.add(fila["orden"])
    assert {fila["orden"] for fila in nuevas}.isdisjoint(ocupadas)


def test_jsonl_utf8_sin_bom(tmp_path) -> None:
    fila = {
        "orden": "Ponle la noche.",
        "fecha_referencia": "2026-08-05",
        "esperado": _ESPERADO,
        "molde_id": "test",
    }
    destino = tmp_path / "decisiones.jsonl"
    escribir_jsonl(destino, [decidir_fila(fila, serializar_respuesta(_ESPERADO))])
    crudo = destino.read_bytes()
    assert not crudo.startswith(b"\xef\xbb\xbf")
    registro = json.loads(crudo.decode("utf-8"))
    assert registro["origen"] == "aprobacion"
