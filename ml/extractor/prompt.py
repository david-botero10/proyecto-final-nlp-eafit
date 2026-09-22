"""Prompt few-shot corto. Nómina y fechas salen del mismo código que el dataset."""

from __future__ import annotations

import json
import sys
from datetime import date
from functools import cache
from pathlib import Path

_RAIZ = Path(__file__).resolve().parents[2]


def _resolver():
    data = str(_RAIZ / "data")
    if data not in sys.path:
        sys.path.insert(0, data)
    from ordenes.fechas import resolver_fechas
    from ordenes.nomina import cargar_nombres

    return resolver_fechas, cargar_nombres


@cache
def nombres_nomina() -> tuple[str, ...]:
    """Nombres completos del seed, en orden."""
    _resolver_fechas, cargar_nombres = _resolver()
    return tuple(cargar_nombres())


def _fechas(expresion: str, referencia: str) -> list[str]:
    resolver_fechas, _cargar = _resolver()
    return [
        dia.isoformat()
        for dia in resolver_fechas(expresion, date.fromisoformat(referencia))
    ]


def ejemplos_fewshot() -> tuple[dict, ...]:
    """Tres demostraciones que no salen de los moldes del dataset."""
    ref = "2026-09-09"
    asignar = {
        "empleado": "Ana Mery Montoya Patiño",
        "turno": "M",
        "fechas": _fechas("la otra semana", ref),
        "justificacion": None,
        "accion": "asignar",
    }
    ausencia = {
        "empleado": "Camila Ríos",
        "turno": None,
        "fechas": _fechas("mañana", ref),
        "justificacion": "permiso",
        "accion": "ausencia",
    }
    return (
        {
            "fecha_referencia": ref,
            "orden": (
                "Anita, déjela en el de la mañana la otra semana, por favor."
            ),
            "esperado": asignar,
        },
        {
            "fecha_referencia": ref,
            "orden": "A Camila regístrele que no viene mañana porque pidió permiso.",
            "esperado": ausencia,
        },
        {
            "fecha_referencia": ref,
            "orden": "Buenas, ¿me cuenta un chiste corto de la clínica?",
            "esperado": None,
        },
    )


def _sistema() -> str:
    nombres = "\n".join(f"- {nombre}" for nombre in nombres_nomina())
    return (
        "Eres el extractor de órdenes de Relevo, una clínica colombiana con "
        "datos sintéticos. Responde SOLO con un JSON de una línea, o con null "
        "si el mensaje no pide asignar un turno, quitarlo o registrar una ausencia. "
        "Una pregunta o un saludo es null, aunque mencione a alguien de la nómina.\n"
        "Claves: empleado (nombre completo de la lista), "
        'turno ("M" mañana, "T" tarde, "N" noche, o null), '
        "fechas (lista ISO, de la más temprana a la más tardía), "
        "justificacion (texto canónico o null), "
        'accion ("asignar", "ausencia" o "quitar").\n'
        "Fechas, contadas contra fecha_referencia: "
        "«la otra semana» = lunes a domingo siguientes; "
        "«el puente» = el próximo festivo (si es lunes, ese lunes; "
        "si es Jueves Santo, también el Viernes Santo); "
        "«de hoy en ocho» = siete días después; "
        "«el finde» = sábado y domingo; "
        "«pasado mañana» = dos días después; "
        "«la primera semana de octubre» = del 1 al 7 de octubre.\n"
        "Justificación canónica: incapacidad, permiso, "
        "fallecimiento familiar, vacaciones, o null. "
        "«está incapacitada», «está incapacitado» y «tiene incapacidad» "
        "son incapacidad. «se le murió un familiar» es fallecimiento familiar. "
        "«pidió permiso» es permiso. «pidió vacaciones» y «sale a vacaciones» "
        "son vacaciones.\n"
        "Nómina:\n"
        f"{nombres}"
    )


def _contenido_esperado(esperado: dict | None) -> str:
    if esperado is None:
        return "null"
    return json.dumps(esperado, ensure_ascii=False)


def construir_mensajes(fila: dict, con_respuesta: bool) -> list[dict[str, str]]:
    """Mensajes de chat: sistema, few-shot y la orden real."""
    mensajes: list[dict[str, str]] = [{"role": "system", "content": _sistema()}]
    for ejemplo in ejemplos_fewshot():
        mensajes.append(
            {
                "role": "user",
                "content": (
                    f"fecha_referencia: {ejemplo['fecha_referencia']}\n"
                    f"orden: {ejemplo['orden']}"
                ),
            }
        )
        mensajes.append(
            {
                "role": "assistant",
                "content": _contenido_esperado(ejemplo["esperado"]),
            }
        )
    mensajes.append(
        {
            "role": "user",
            "content": (
                f"fecha_referencia: {fila['fecha_referencia']}\n"
                f"orden: {fila['orden']}"
            ),
        }
    )
    if con_respuesta:
        mensajes.append(
            {
                "role": "assistant",
                "content": _contenido_esperado(fila["esperado"]),
            }
        )
    return mensajes


ORDENES_FEWSHOT: tuple[str, ...] = tuple(
    ejemplo["orden"] for ejemplo in ejemplos_fewshot()
)
