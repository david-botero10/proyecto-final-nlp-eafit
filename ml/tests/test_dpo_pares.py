"""Construcción de pares DPO. No toca la base ni el modelo."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from dpo.pares import ejemplos_desde_filas, interpretar_prompt, marcar_orden
from extractor.prompt import construir_mensajes, serializar_respuesta

_BOGOTA = ZoneInfo("America/Bogota")
_ELEGIDA = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "N",
    "fechas": ["2026-08-07"],
    "justificacion": None,
    "accion": "asignar",
}
_RECHAZADA = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "M",
    "fechas": ["2026-08-07"],
    "justificacion": None,
    "accion": "asignar",
}


def _fila(**cambios) -> dict:
    base = {
        "prompt_texto": marcar_orden(
            "Asígnele la noche completa a Ana el puente.",
            "2026-08-05",
        ),
        "elegida": dict(_ELEGIDA),
        "rechazada": dict(_RECHAZADA),
        "origen": "correccion",
        "creado_en": datetime(2026, 9, 21, 18, 0, tzinfo=ZoneInfo("UTC")),
        "usuario": "simulador",
    }
    base.update(cambios)
    return base


def test_marca_recupera_la_fecha_y_la_orden() -> None:
    texto = marcar_orden("Ponle el turno.", "2026-08-05")
    orden, fecha, marca = interpretar_prompt(
        texto, datetime(2026, 1, 1, tzinfo=_BOGOTA)
    )
    assert orden == "Ponle el turno."
    assert fecha == "2026-08-05"
    assert marca == "simulador"


def test_aprobacion_limpia_no_entra_al_dpo() -> None:
    resultado = ejemplos_desde_filas([_fila(rechazada=None, origen="aprobacion")])
    assert resultado.dpo == []
    assert resultado.conteos["por_origen"]["aprobacion"] == 1
    assert resultado.conteos["dpo"] == 0


def test_aprobacion_limpia_puede_ir_a_sft() -> None:
    resultado = ejemplos_desde_filas(
        [_fila(rechazada=None, origen="aprobacion")],
        incluir_aprobaciones=True,
    )
    assert resultado.dpo == []
    assert len(resultado.sft) == 1
    assert resultado.sft[0]["messages"][-1]["content"] == serializar_respuesta(
        _ELEGIDA
    )


def test_iguales_se_descartan() -> None:
    resultado = ejemplos_desde_filas([_fila(rechazada=dict(_ELEGIDA))])
    assert resultado.dpo == []
    assert resultado.conteos["descartados_iguales"] == 1


def test_correccion_tiene_el_formato_trl() -> None:
    orden = "Asígnele la noche completa a Ana el puente."
    fila = _fila(
        elegida={**_ELEGIDA, "proveedor": "xai"},
        rechazada={**_RECHAZADA, "proveedor": "lora"},
    )
    resultado = ejemplos_desde_filas([fila])
    assert len(resultado.dpo) == 1
    ejemplo = resultado.dpo[0]
    assert set(ejemplo) >= {"prompt", "chosen", "rejected"}
    assert ejemplo["prompt"] == construir_mensajes(
        {"orden": orden, "fecha_referencia": "2026-08-05"},
        False,
    )
    assert ejemplo["chosen"] == [
        {"role": "assistant", "content": serializar_respuesta(_ELEGIDA)}
    ]
    assert ejemplo["rejected"] == [
        {"role": "assistant", "content": serializar_respuesta(_RECHAZADA)}
    ]
    assert "proveedor" not in ejemplo["chosen"][0]["content"]


def test_rechazo_con_elegida_null_es_par() -> None:
    fila = _fila(
        origen="rechazo",
        elegida=None,
        rechazada=dict(_RECHAZADA),
        usuario="coordinador",
        prompt_texto="Quítale el turno a Ana mañana.",
        creado_en=datetime(2026, 9, 22, 2, 30, tzinfo=ZoneInfo("UTC")),
    )
    resultado = ejemplos_desde_filas([fila])
    assert len(resultado.dpo) == 1
    assert resultado.dpo[0]["chosen"][0]["content"] == "null"
    assert resultado.dpo[0]["marca"] == "humana"
    assert resultado.dpo[0]["prompt"][-1]["content"].startswith(
        "fecha_referencia: 2026-09-21\n"
    )
