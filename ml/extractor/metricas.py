"""Métricas del harness. Puras: no cargan modelo ni tocan la red.

Un fallo de parseo no es un null. El null solo cuenta cuando el JSON es
válido y el valor es null (null-match). La F1 de fechas es macro: el
promedio de la F1 de conjuntos por ejemplo. Dos conjuntos vacíos valen 1.
"""

from __future__ import annotations

from dataclasses import dataclass

CAMPOS = ("empleado", "turno", "accion", "justificacion")


@dataclass(frozen=True)
class ParEval:
    """Un ejemplo del test y lo que dijo el modelo."""

    esperado: dict | None
    prediccion: dict | None
    json_ok: bool


def f1_conjunto(gold: set[str], pred: set[str]) -> float:
    """F1 entre dos conjuntos. Vacío contra vacío es 1; si uno solo está vacío, 0."""
    if not gold and not pred:
        return 1.0
    if not gold or not pred:
        return 0.0
    tp = len(gold & pred)
    precision = tp / len(pred)
    recall = tp / len(gold)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def _prediccion_usable(par: ParEval) -> dict | None | str:
    """None = null válido; str 'invalido' = no se pudo parsear."""
    if not par.json_ok:
        return "invalido"
    return par.prediccion


def campo_coincide(par: ParEval, campo: str) -> bool:
    """True si el campo cuadra, incluido el caso null contra null."""
    pred = _prediccion_usable(par)
    if pred == "invalido":
        return False
    gold = par.esperado
    if gold is None and pred is None:
        return True
    if gold is None or pred is None:
        return False
    return gold[campo] == pred[campo]


def f1_fechas(par: ParEval) -> float:
    """F1 del conjunto de fechas de un ejemplo."""
    pred = _prediccion_usable(par)
    if pred == "invalido":
        return 0.0
    gold = par.esperado
    if gold is None and pred is None:
        return 1.0
    if gold is None or pred is None:
        return 0.0
    return f1_conjunto(set(gold["fechas"]), set(pred["fechas"]))


def total_coincide(par: ParEval) -> bool:
    """True si todos los campos y el conjunto de fechas coinciden."""
    pred = _prediccion_usable(par)
    if pred == "invalido":
        return False
    gold = par.esperado
    if gold is None or pred is None:
        return gold is None and pred is None
    if any(gold[campo] != pred[campo] for campo in CAMPOS):
        return False
    return set(gold["fechas"]) == set(pred["fechas"])


def calcular_metricas(pares: list[ParEval]) -> dict[str, float | int]:
    """Exactitud por campo, F1 macro de fechas, % JSON válido y exactitud total."""
    n = len(pares)
    if n == 0:
        raise ValueError("no hay pares para evaluar")
    metricas: dict[str, float | int] = {"n": n}
    for campo in CAMPOS:
        aciertos = sum(1 for par in pares if campo_coincide(par, campo))
        metricas[f"exactitud_{campo}"] = aciertos / n
    metricas["f1_fechas"] = sum(f1_fechas(par) for par in pares) / n
    metricas["json_valido"] = sum(1 for par in pares if par.json_ok) / n
    metricas["exactitud_total"] = sum(1 for par in pares if total_coincide(par)) / n
    return metricas


def tabla_markdown(metricas: dict[str, float | int], titulo: str) -> str:
    """Tabla de una corrida, en porcentaje con dos decimales."""
    filas = [
        ("empleado", "exactitud_empleado"),
        ("turno", "exactitud_turno"),
        ("accion", "exactitud_accion"),
        ("justificacion", "exactitud_justificacion"),
        ("fechas (F1)", "f1_fechas"),
        ("JSON válido", "json_valido"),
        ("exactitud total", "exactitud_total"),
    ]
    lineas = [
        f"### {titulo}",
        "",
        "| métrica | valor |",
        "|---|---:|",
    ]
    for nombre, clave in filas:
        valor = float(metricas[clave]) * 100
        lineas.append(f"| {nombre} | {valor:.2f} % |")
    lineas.append("")
    lineas.append(f"n = {metricas['n']}")
    return "\n".join(lineas)
