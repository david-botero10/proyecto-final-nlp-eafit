"""Parser, métricas a mano y prompt. No carga el modelo."""

from __future__ import annotations

from extractor.metricas import ParEval, calcular_metricas, f1_conjunto
from extractor.parser import parsear_extraccion
from extractor.prompt import ejemplos_fewshot, nombres_nomina

_ANA = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "M",
    "fechas": ["2026-10-01", "2026-10-02"],
    "justificacion": None,
    "accion": "asignar",
}
_CIRO = {
    "empleado": "Ciro Oviedo Tovar",
    "turno": None,
    "fechas": ["2026-10-03"],
    "justificacion": "permiso",
    "accion": "ausencia",
}
_PRED_ANA = {
    "empleado": "Ana Mery Montoya Patiño",
    "turno": "M",
    "fechas": ["2026-10-01", "2026-10-03"],
    "justificacion": None,
    "accion": "asignar",
}


def test_f1_de_conjuntos_a_mano() -> None:
    # tp=1, |pred|=2, |gold|=2 → p=r=0.5 → f1=0.5
    gold = {"2026-10-01", "2026-10-02"}
    pred = {"2026-10-01", "2026-10-03"}
    assert f1_conjunto(gold, pred) == 0.5
    assert f1_conjunto(set(), set()) == 1.0
    assert f1_conjunto({"2026-10-01"}, set()) == 0.0
    assert f1_conjunto(set(), {"2026-10-01"}) == 0.0


def test_metricas_con_fixture_calculado_a_mano() -> None:
    # 1: fechas {1,2} vs {1,3} → f1 0.5, total falso. Resto de campos cuadra.
    # 2: todo cuadra, turno null contra null, f1 1, total verdadero.
    # 3: gold null y pred null → null-match en cada campo, f1 1, total verdadero.
    # 4: JSON inválido no es null: todo falso, f1 0.
    pares = [
        ParEval(_ANA, _PRED_ANA, True),
        ParEval(_CIRO, _CIRO, True),
        ParEval(None, None, True),
        ParEval(_ANA, None, False),
    ]
    metricas = calcular_metricas(pares)
    assert metricas["n"] == 4
    assert metricas["exactitud_empleado"] == 0.75
    assert metricas["exactitud_turno"] == 0.75
    assert metricas["exactitud_accion"] == 0.75
    assert metricas["exactitud_justificacion"] == 0.75
    assert metricas["f1_fechas"] == 0.625
    assert metricas["json_valido"] == 0.75
    assert metricas["exactitud_total"] == 0.5


def test_parser_acepta_fences_ruido_y_null() -> None:
    crudo = (
        '```json\n{"empleado": "Ana Mery Montoya Patiño", "turno": "M", '
        '"fechas": ["2026-10-01"], "justificacion": null, "accion": "asignar"}\n```'
    )
    parseo = parsear_extraccion("nota previa\n" + crudo + "\nfin")
    assert parseo["ok"] is True
    assert parseo["valor"]["turno"] == "M"
    assert parseo["valor"]["justificacion"] is None
    assert parsear_extraccion("null")["valor"] is None
    assert parsear_extraccion("null")["ok"] is True
    assert parsear_extraccion("<think>pienso</think>\nnull")["ok"] is True


def test_parser_no_revienta_con_json_invalido() -> None:
    malos = ("{empleado: Ana}", "", "no es json", "[1, 2]", None, "```json\n{]\n```")
    for texto in malos:
        parseo = parsear_extraccion(texto)
        assert parseo["ok"] is False
        assert parseo["valor"] is None
        assert parseo["error"]


def test_parser_rechaza_turno_fuera_de_contrato() -> None:
    texto = (
        '{"empleado": "Ana Mery Montoya Patiño", "turno": "mañana", '
        '"fechas": ["2026-10-01"], "justificacion": null, "accion": "asignar"}'
    )
    assert parsear_extraccion(texto)["ok"] is False


def test_prompt_incluye_nomina_y_fechas_del_resolver() -> None:
    assert "Ana Mery Montoya Patiño" in nombres_nomina()
    assert len(nombres_nomina()) == 40
    ejemplos = ejemplos_fewshot()
    asignar = ejemplos[0]["esperado"]
    assert asignar["fechas"][0] == "2026-09-14"
    assert asignar["fechas"][-1] == "2026-09-20"
    assert ejemplos[1]["esperado"]["fechas"] == ["2026-09-10"]
    assert ejemplos[1]["esperado"]["justificacion"] == "permiso"
    assert ejemplos[2]["esperado"] is None
