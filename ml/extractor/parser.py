"""Parser robusto: la salida del modelo es JSON, fences o null. Nunca revienta."""

from __future__ import annotations

import json
import re
from typing import TypedDict

_FENCE = re.compile(r"```(?:json)?", re.IGNORECASE)
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_ACCIONES = frozenset({"asignar", "ausencia", "quitar"})
_TURNOS = frozenset({"M", "T", "N"})
_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Parseo(TypedDict):
    """Resultado de parsear una generación."""

    ok: bool
    valor: dict | None
    error: str | None


def _fallo(mensaje: str) -> Parseo:
    return {"ok": False, "valor": None, "error": mensaje}


def _ok(valor: dict | None) -> Parseo:
    return {"ok": True, "valor": valor, "error": None}


def _extraer_objeto(texto: str) -> str | None:
    """Recorta el primer objeto JSON balanceado, respetando strings."""
    inicio = texto.find("{")
    if inicio < 0:
        return None
    profundidad = 0
    en_string = False
    escape = False
    for indice in range(inicio, len(texto)):
        caracter = texto[indice]
        if en_string:
            if escape:
                escape = False
            elif caracter == "\\":
                escape = True
            elif caracter == '"':
                en_string = False
            continue
        if caracter == '"':
            en_string = True
        elif caracter == "{":
            profundidad += 1
        elif caracter == "}":
            profundidad -= 1
            if profundidad == 0:
                return texto[inicio : indice + 1]
    return None


def _normalizar(valor: dict) -> dict | None:
    if not isinstance(valor.get("empleado"), str) or not valor["empleado"].strip():
        return None
    turno = valor.get("turno")
    if turno is not None and turno not in _TURNOS:
        return None
    fechas = valor.get("fechas")
    if not isinstance(fechas, list) or not all(
        isinstance(dia, str) and _FECHA.match(dia) for dia in fechas
    ):
        return None
    justificacion = valor.get("justificacion")
    if justificacion is not None and not isinstance(justificacion, str):
        return None
    accion = valor.get("accion")
    if accion not in _ACCIONES:
        return None
    return {
        "empleado": valor["empleado"].strip(),
        "turno": turno,
        "fechas": list(fechas),
        "justificacion": justificacion,
        "accion": accion,
    }


def parsear_extraccion(texto: str | None) -> Parseo:
    """Interpreta la salida del modelo. JSON inválido → ok False, sin excepción."""
    if texto is None:
        return _fallo("salida vacía")
    limpio = _THINK.sub("", texto).strip()
    limpio = _FENCE.sub("", limpio).strip()
    if limpio.lower() in {"null", "null."}:
        return _ok(None)
    objeto = _extraer_objeto(limpio)
    if objeto is None:
        if re.fullmatch(r"null\.?", limpio.strip(), flags=re.IGNORECASE):
            return _ok(None)
        return _fallo("no hay objeto JSON ni null")
    try:
        valor = json.loads(objeto)
    except json.JSONDecodeError as exc:
        return _fallo(f"json inválido: {exc.msg}")
    if not isinstance(valor, dict):
        return _fallo("el JSON no es un objeto")
    normalizado = _normalizar(valor)
    if normalizado is None:
        return _fallo("el objeto no cumple el contrato")
    return _ok(normalizado)
