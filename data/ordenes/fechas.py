"""Resolución de fechas relativas contra una fecha de referencia.

Reglas (deterministas, las mismas que enseña el prompt del extractor):

- «la otra semana»: lunes a domingo de la semana siguiente, no la corriente.
  Si la referencia ya es lunes, empieza el lunes siguiente.
- «el puente»: el próximo festivo. Si cae en lunes, ese lunes (el puente de
  la Ley Emiliani). Si es jueves y el viernes también es festivo (Semana
  Santa), ambos días. En otro caso, solo el festivo.
- «de hoy en ocho»: siete días después (conteo inclusivo colombiano: el
  mismo día de la semana siguiente).
- «el finde»: sábado y domingo del fin de semana que viene; si la referencia
  ya es sábado o domingo, el fin de semana en curso.
- «pasado mañana»: dos días después. «mañana» y «hoy» son +1 y +0.
- «la primera semana de octubre»: del 1 al 7 de octubre del año en curso,
  o del año siguiente si esa ventana ya pasó.
"""

from __future__ import annotations

from datetime import date, timedelta

from .festivos import es_festivo, siguiente_festivo

# Superficie coloquial → clave interna. La clave también se acepta tal cual.
_SUPERFICIE: dict[str, str] = {
    "la otra semana": "otra_semana",
    "el puente": "puente",
    "de hoy en ocho": "hoy_en_ocho",
    "pasado mañana": "pasado_manana",
    "el finde": "finde",
    "mañana": "manana",
    "hoy": "hoy",
    "esta semana": "esta_semana",
    "de lunes a viernes de la otra semana": "lunes_viernes",
    "la primera semana de octubre": "primera_octubre",
    "el lunes": "proximo_lunes",
    "el 12 de octubre": "octubre_12",
}


def _rango(inicio: date, dias: int) -> list[date]:
    return [inicio + timedelta(days=i) for i in range(dias)]


def _otra_semana(referencia: date) -> list[date]:
    falta = (7 - referencia.weekday()) % 7
    if falta == 0:
        falta = 7
    return _rango(referencia + timedelta(days=falta), 7)


def _esta_semana(referencia: date) -> list[date]:
    lunes = referencia - timedelta(days=referencia.weekday())
    return _rango(lunes, 7)


def _finde(referencia: date) -> list[date]:
    wd = referencia.weekday()
    if wd <= 4:
        sabado = referencia + timedelta(days=5 - wd)
    elif wd == 5:
        sabado = referencia
    else:
        sabado = referencia - timedelta(days=1)
    return [sabado, sabado + timedelta(days=1)]


def _puente(referencia: date) -> list[date]:
    festivo = siguiente_festivo(referencia)
    if festivo.weekday() == 0:
        return [festivo]
    if festivo.weekday() == 3:
        viernes = festivo + timedelta(days=1)
        if es_festivo(viernes):
            return [festivo, viernes]
    return [festivo]


def _dia_fijo(referencia: date, mes: int, dia: int) -> list[date]:
    candidato = date(referencia.year, mes, dia)
    if candidato < referencia:
        candidato = date(referencia.year + 1, mes, dia)
    return [candidato]


def _primera_semana_octubre(referencia: date) -> list[date]:
    inicio = date(referencia.year, 10, 1)
    fin = date(referencia.year, 10, 7)
    if referencia > fin:
        inicio = date(referencia.year + 1, 10, 1)
    return _rango(inicio, 7)


def _proximo_weekday(referencia: date, weekday: int) -> list[date]:
    delta = (weekday - referencia.weekday()) % 7
    return [referencia + timedelta(days=delta)]


_RESOLUTORES = {
    "otra_semana": _otra_semana,
    "esta_semana": _esta_semana,
    "finde": _finde,
    "puente": _puente,
    "hoy_en_ocho": lambda ref: [ref + timedelta(days=7)],
    "pasado_manana": lambda ref: [ref + timedelta(days=2)],
    "manana": lambda ref: [ref + timedelta(days=1)],
    "hoy": lambda ref: [ref],
    "lunes_viernes": lambda ref: _otra_semana(ref)[:5],
    "primera_octubre": _primera_semana_octubre,
    "proximo_lunes": lambda ref: _proximo_weekday(ref, 0),
    "octubre_12": lambda ref: _dia_fijo(ref, 10, 12),
}


def resolver_fechas(expresion: str, fecha_referencia: date) -> list[date]:
    """Fechas concretas de una expresión coloquial.

    Acepta la frase («la otra semana») o la clave interna («otra_semana»).
    """
    clave = _SUPERFICIE.get(expresion, expresion)
    try:
        resolver = _RESOLUTORES[clave]
    except KeyError as exc:
        raise ValueError(f"expresión de fecha desconocida: {expresion}") from exc
    fechas = resolver(fecha_referencia)
    if fechas != sorted(fechas):
        raise RuntimeError(f"fechas sin ordenar para {expresion}")
    return fechas
