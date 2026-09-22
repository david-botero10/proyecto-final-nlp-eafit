"""Fechas relativas, determinismo y splits del dataset de órdenes. Sin red."""

from __future__ import annotations

import hashlib
from datetime import date, timedelta
from pathlib import Path

from extractor.prompt import ORDENES_FEWSHOT
from ordenes.fechas import resolver_fechas
from ordenes.festivos import FESTIVOS_2026, es_festivo
from ordenes.generar_ordenes import (
    NEGATIVOS,
    generar_sinteticos,
    leer_jsonl,
    main,
    split_por_hash,
)
from ordenes.nomina import cargar_nombres, construir_alias, genero_de
from ordenes.plantillas import MOLDES

_RAIZ = Path(__file__).resolve().parents[2]
_ORDENES = _RAIZ / "data" / "ordenes"
_REF = date(2026, 9, 9)


def _positivos(splits: dict) -> list:
    return [
        fila
        for filas in splits.values()
        for fila in filas
        if fila.esperado is not None
    ]


def test_la_otra_semana_es_lunes_a_domingo_siguientes() -> None:
    fechas = resolver_fechas("la otra semana", _REF)
    assert fechas[0] == date(2026, 9, 14)
    assert fechas[-1] == date(2026, 9, 20)
    assert fechas[0].weekday() == 0
    assert fechas[-1].weekday() == 6
    assert fechas == [fechas[0] + timedelta(days=i) for i in range(7)]


def test_el_puente_es_el_siguiente_festivo_con_su_lunes() -> None:
    assert resolver_fechas("el puente", _REF) == [date(2026, 10, 12)]
    assert date(2026, 10, 12).weekday() == 0
    assert es_festivo(date(2026, 10, 12))


def test_de_hoy_en_ocho() -> None:
    assert resolver_fechas("de hoy en ocho", _REF) == [date(2026, 9, 16)]


def test_pasado_manana_finde_y_octubre() -> None:
    assert resolver_fechas("pasado mañana", _REF) == [date(2026, 9, 11)]
    assert resolver_fechas("el finde", _REF) == [date(2026, 9, 12), date(2026, 9, 13)]
    octubre = resolver_fechas("la primera semana de octubre", _REF)
    assert octubre[0] == date(2026, 10, 1)
    assert octubre[-1] == date(2026, 10, 7)
    assert len(octubre) == 7


def test_puente_de_semana_santa_incluye_jueves_y_viernes() -> None:
    assert resolver_fechas("el puente", date(2026, 4, 1)) == [
        date(2026, 4, 2),
        date(2026, 4, 3),
    ]


def test_calendario_2026_tiene_los_festivos_conocidos() -> None:
    assert len(FESTIVOS_2026) == 19
    assert date(2026, 8, 7).weekday() == 4
    assert es_festivo(date(2026, 8, 7))
    assert date(2026, 7, 13).weekday() == 0
    assert es_festivo(date(2026, 7, 13))
    assert not es_festivo(date(2026, 9, 9))


def test_alias_inequivocos_y_diminutivo_de_ana() -> None:
    nombres = cargar_nombres()
    alias = construir_alias(nombres)
    assert alias["Ana"] == "Ana Mery Montoya Patiño"
    assert alias["Anita"] == "Ana Mery Montoya Patiño"
    assert "Diego" not in alias
    assert "Elizabeth" not in alias
    assert set(alias.values()) == set(nombres)
    for forma, destino in alias.items():
        assert destino in nombres
        assert forma


def test_generador_es_determinista_y_cubre_cuotas() -> None:
    primero = generar_sinteticos()
    segundo = generar_sinteticos()
    for split in ("train", "val", "test"):
        a = [fila.registro() for fila in sorted(primero[split], key=lambda f: f.orden)]
        b = [fila.registro() for fila in sorted(segundo[split], key=lambda f: f.orden)]
        assert a == b
    assert sum(1 for f in primero["train"] if f.grupo_molde == "pool") == 350
    assert sum(1 for f in primero["val"] if f.grupo_molde == "pool") == 50
    assert sum(1 for f in primero["test"] if f.grupo_molde == "test") == 60
    assert sum(1 for f in primero["train"] if f.molde_id == "negativo") == 30
    assert sum(1 for f in primero["val"] if f.molde_id == "negativo") == 5
    assert sum(1 for f in primero["test"] if f.molde_id == "negativo") == 5
    assert len(NEGATIVOS) == 40


def test_hash_separa_train_y_val_sin_fuga_de_molde() -> None:
    splits = generar_sinteticos()
    textos = {split: {fila.orden for fila in filas} for split, filas in splits.items()}
    assert textos["train"].isdisjoint(textos["val"])
    assert textos["train"].isdisjoint(textos["test"])
    assert textos["val"].isdisjoint(textos["test"])
    for fila in splits["train"] + splits["val"]:
        if fila.grupo_molde != "pool":
            continue
        assert fila.split == split_por_hash(fila.orden)
    pool = {fila.molde_id for fila in _positivos(splits) if fila.grupo_molde == "pool"}
    test = {fila.molde_id for fila in splits["test"] if fila.grupo_molde == "test"}
    assert pool.isdisjoint(test)
    frases_pool = {m.plantilla for m in MOLDES if m.grupo == "pool"}
    frases_test = {m.plantilla for m in MOLDES if m.grupo == "test"}
    assert frases_pool.isdisjoint(frases_test)
    for orden in ORDENES_FEWSHOT:
        assert orden not in textos["train"] | textos["val"] | textos["test"]


def test_genero_de_la_incapacidad_concuerda() -> None:
    for fila in _positivos(generar_sinteticos()):
        if "está incapacitada" in fila.orden:
            assert genero_de(fila.esperado["empleado"]) == "f"
        if "está incapacitado" in fila.orden:
            assert genero_de(fila.esperado["empleado"]) == "m"


def test_main_escribe_utf8_sin_bom(tmp_path: Path) -> None:
    assert main(["--sin-massive", "--salida", str(tmp_path)]) == 0
    sint = generar_sinteticos()
    for split in ("train", "val", "test"):
        ruta = tmp_path / f"{split}.jsonl"
        bruto = ruta.read_bytes()
        assert not bruto.startswith(b"\xef\xbb\xbf")
        assert b"\r" not in bruto
        disco = {fila["orden"]: fila for fila in leer_jsonl(ruta)}
        esperado = {fila.orden: fila.registro() for fila in sint[split]}
        assert disco == esperado


def test_jsonl_comiteado_cubre_el_generador() -> None:
    sint = generar_sinteticos()
    for split, filas in sint.items():
        disco = leer_jsonl(_ORDENES / f"{split}.jsonl")
        por_orden = {fila["orden"]: fila for fila in disco}
        for fila in filas:
            assert por_orden[fila.orden] == fila.registro()
        if split != "train":
            assert set(por_orden) == {fila.orden for fila in filas}
            continue
        extras = set(por_orden) - {fila.orden for fila in filas}
        for orden in extras:
            assert por_orden[orden]["esperado"] is None


def test_negativos_se_cortan_por_sha256() -> None:
    ordenados = sorted(NEGATIVOS, key=lambda t: hashlib.sha256(t.encode()).hexdigest())
    splits = generar_sinteticos()
    vistos = {
        fila.orden: fila.split
        for filas in splits.values()
        for fila in filas
        if fila.molde_id == "negativo"
    }
    for texto in ordenados[:5]:
        assert vistos[texto] == "test"
    for texto in ordenados[5:10]:
        assert vistos[texto] == "val"
    for texto in ordenados[10:]:
        assert vistos[texto] == "train"
