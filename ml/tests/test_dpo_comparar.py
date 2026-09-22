"""Tabla e intervalo bootstrap con predicciones de fixture."""

from __future__ import annotations

from dpo.comparar import (
    aciertos_totales,
    clase_fecha,
    intervalo_bootstrap,
    tabla_comparacion,
)

_ANA = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "M",
    "fechas": ["2026-10-01"],
    "justificacion": None,
    "accion": "asignar",
}
_OTRA = {**_ANA, "accion": "quitar", "turno": None}


def _metricas(total: float) -> dict:
    return {
        "n": 4,
        "exactitud_empleado": total,
        "exactitud_turno": total,
        "exactitud_accion": total,
        "exactitud_justificacion": total,
        "f1_fechas": total,
        "json_valido": 1.0,
        "exactitud_total": total,
    }


def test_intervalo_contiene_la_media() -> None:
    aciertos = [True, True, False, True]
    intervalo = intervalo_bootstrap(aciertos, remuestreos=1000, semilla=42)
    assert intervalo["media"] == 0.75
    assert intervalo["bajo"] <= intervalo["media"] <= intervalo["alto"]
    assert intervalo["remuestreos"] == 1000


def test_clase_de_fecha() -> None:
    assert clase_fecha("A Ana no le deje turno el 12 de octubre.") == "absoluta"
    assert clase_fecha("Asígnele la noche a Bernardo el lunes.") == "relativa"
    assert clase_fecha("Chao, que le vaya bien en el turno.") == "sin_fecha"


def test_tabla_tiene_delta_y_pendiente() -> None:
    versiones = {
        "base": _metricas(0.25),
        "v1": _metricas(0.5),
        "v2": _metricas(0.75),
        "grok": None,
    }
    intervalos = {
        "base": intervalo_bootstrap([True, False, False, False]),
        "v1": intervalo_bootstrap([True, True, False, False]),
        "v2": intervalo_bootstrap([True, True, True, False]),
    }
    subgrupos = {
        "relativa": {
            "base": _metricas(0.25),
            "v1": _metricas(0.5),
            "v2": _metricas(0.75),
        }
    }
    texto = tabla_comparacion(versiones, intervalos, subgrupos, True)
    assert "| métrica | base | v1 | v2 | delta v1→v2 | Grok |" in texto
    assert "pendiente" in texto
    assert "+25.00 pp" in texto
    assert "Fechas relativas" in texto


def test_aciertos_totales_del_detalle() -> None:
    detalle = [
        {"esperado": _ANA, "prediccion": _ANA, "json_ok": True},
        {"esperado": _ANA, "prediccion": _OTRA, "json_ok": True},
    ]
    assert aciertos_totales(detalle) == [True, False]
