"""Festivos nacionales de Colombia en 2026.

Lista cerrada, contrastada con el calendario de Ley 51 de 1983 (Emiliani)
y con la inclusión de la Virgen de Chiquinquirá (lunes 13 de julio de 2026,
primer lunes a partir del 9 de julio). No se calcula la Pascua en caliente:
las fechas variables ya están resueltas para este año.
"""

from __future__ import annotations

from datetime import date

# (fecha, nombre). El orden es cronológico.
FESTIVOS_2026: tuple[tuple[date, str], ...] = (
    (date(2026, 1, 1), "Año Nuevo"),
    (date(2026, 1, 12), "Reyes Magos"),
    (date(2026, 3, 23), "San José"),
    (date(2026, 4, 2), "Jueves Santo"),
    (date(2026, 4, 3), "Viernes Santo"),
    (date(2026, 5, 1), "Día del Trabajo"),
    (date(2026, 5, 18), "Ascensión"),
    (date(2026, 6, 8), "Corpus Christi"),
    (date(2026, 6, 15), "Sagrado Corazón"),
    (date(2026, 6, 29), "San Pedro y San Pablo"),
    (date(2026, 7, 13), "Virgen de Chiquinquirá"),
    (date(2026, 7, 20), "Independencia"),
    (date(2026, 8, 7), "Batalla de Boyacá"),
    (date(2026, 8, 17), "Asunción"),
    (date(2026, 10, 12), "Día de la Raza"),
    (date(2026, 11, 2), "Todos los Santos"),
    (date(2026, 11, 16), "Independencia de Cartagena"),
    (date(2026, 12, 8), "Inmaculada Concepción"),
    (date(2026, 12, 25), "Navidad"),
)

FESTIVOS: frozenset[date] = frozenset(dia for dia, _nombre in FESTIVOS_2026)


def es_festivo(dia: date) -> bool:
    """True si `dia` es festivo nacional colombiano en 2026."""
    return dia in FESTIVOS


def siguiente_festivo(referencia: date) -> date:
    """Primer festivo en o después de `referencia`."""
    for dia, _nombre in FESTIVOS_2026:
        if dia >= referencia:
            return dia
    raise ValueError(f"no hay festivo de 2026 en o después de {referencia.isoformat()}")
