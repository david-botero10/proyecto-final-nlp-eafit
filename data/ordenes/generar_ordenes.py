"""Genera train/val/test de órdenes coloquiales. Semilla 42, determinista.

Split:
- Positivos del pool: train si sha256(orden) % 8 != 0, val si % 8 == 0.
  No se mueve un ejemplo de cubeta para llenar la otra: si la cubeta está
  llena, se descarta.
- Positivos de test: moldes reservados, nunca vistos en train/val.
- Negativos sintéticos (~40): se ordenan por sha256 y se cortan 5 test,
  5 val y 30 train.
- MASSIVE es-ES, si descarga, se agrega solo a train con esperado null.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .fechas import resolver_fechas
from .nomina import alias_de, cargar_nombres, construir_alias, genero_de
from .plantillas import Molde, moldes_de

SEMILLA = 42
N_TRAIN = 350
N_VAL = 50
N_TEST = 60
N_NEG_TEST = 5
N_NEG_VAL = 5
N_NEG_TRAIN = 30

CUOTAS: dict[str, dict[str, int]] = {
    "asignar": {"train": 170, "val": 24},
    "ausencia": {"train": 90, "val": 13},
    "quitar": {"train": 90, "val": 13},
}
N_TEST_POR_ACCION = 20

REFERENCIAS: tuple[date, ...] = (
    date(2026, 8, 5),
    date(2026, 8, 10),
    date(2026, 8, 14),
    date(2026, 9, 2),
    date(2026, 9, 9),
    date(2026, 9, 16),
    date(2026, 9, 23),
    date(2026, 9, 30),
    date(2026, 10, 5),
    date(2026, 10, 19),
    date(2026, 11, 4),
    date(2026, 11, 18),
)

# Charla y consultas: no son órdenes de escritura. 40 frases fijas.
NEGATIVOS: tuple[str, ...] = (
    "¿Quién está de turno el sábado en la noche?",
    "¿Cuánto es el recargo nocturno según el código?",
    "Buenos días, ¿cómo va la clínica hoy?",
    "Gracias, parce, hablamos luego.",
    "¿Ana Mery trabaja mañana o está libre?",
    "Hágame el favor y me cuenta cómo quedó el fin de semana.",
    "¿Qué dice la norma del dominical?",
    "Listo, quedo atento a lo que me diga.",
    "¿Me puede mostrar las ausencias de enfermería?",
    "Oiga, ¿a qué hora entra el turno de la noche normalmente?",
    "No es una orden, solo quería saludar.",
    "¿El puente de octubre quién lo cubre? Es solo una pregunta.",
    "Camila, ¿usted ya almorzó?",
    "Recuérdeme después revisar el inventario, porfa.",
    "¿Cuántas horas extras lleva Carlos esta semana?",
    "Buenas tardes, ¿cómo están todos por allá?",
    "El recargo de la noche es lo que no me cuadra, explíqueme.",
    "¿Puede buscarme el artículo del descanso dominical?",
    "Jaja, qué pereza madrugar, ¿no?",
    "¿Quién es el jefe de enfermería?",
    "Mándeme un resumen de la nómina, sin cambiar nada.",
    "¿Patricia está activa en el sistema?",
    "Hola, soy el coordinador, solo pasaba a mirar.",
    "¿Hay solapes el lunes en recepción?",
    "Explíqueme qué es un turno rotativo, de una.",
    "No le cambie nada a nadie todavía.",
    "¿Me confirma si el domingo se trabaja en vigilancia?",
    "Gracias por la ayuda de ayer, de verdad.",
    "¿Cuál es el horario de la mañana, seis a dos?",
    "Quisiera saber, no ordenar: ¿Karen pidió vacaciones?",
    "¿Qué equipos tenemos en la clínica?",
    "Parece que va a llover, ¿sí cerramos la ventana?",
    "¿El código permite el turno de doce horas?",
    "Buenas, ¿está por ahí el supervisor?",
    "No haga cambios: solo quiero entender la regla del festivo.",
    "¿Cuántos vigilantes hay de noche?",
    "Listo, entonces yo miro y le aviso, sin programar aún.",
    "¿Me repite la diferencia entre permiso e incapacidad?",
    "Chao, que le vaya bien en el turno.",
    "¿Esto es una consulta o ya puedo colgar?",
)


@dataclass(frozen=True)
class Ejemplo:
    """Una fila del dataset, antes de serializar."""

    orden: str
    fecha_referencia: date
    esperado: dict | None
    molde_id: str
    cuando: str | None
    grupo_molde: str
    split: str

    def registro(self) -> dict:
        """Objeto JSONL: orden, fecha_referencia, esperado."""
        if self.esperado is None:
            etiqueta = None
        else:
            etiqueta = {
                "empleado": self.esperado["empleado"],
                "turno": self.esperado["turno"],
                "fechas": list(self.esperado["fechas"]),
                "justificacion": self.esperado["justificacion"],
                "accion": self.esperado["accion"],
            }
        return {
            "orden": self.orden,
            "fecha_referencia": self.fecha_referencia.isoformat(),
            "esperado": etiqueta,
        }


def _sha(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def split_por_hash(orden: str) -> str:
    """Cubeta train/val de un positivo del pool."""
    numero = int(_sha(orden)[:8], 16)
    return "val" if numero % 8 == 0 else "train"


def materializar(
    molde: Molde,
    nombre: str,
    alias: dict[str, str],
) -> Ejemplo:
    """Arma la orden y la etiqueta a partir de un molde y un empleado."""
    formas = alias_de(nombre, alias)
    digest = _sha(f"{molde.id}|{nombre}")
    forma = formas[int(digest[:8], 16) % len(formas)]
    referencia = REFERENCIAS[int(digest[8:16], 16) % len(REFERENCIAS)]
    fechas = tuple(dia.isoformat() for dia in resolver_fechas(molde.cuando, referencia))
    orden = molde.plantilla.format(
        alias=forma,
        turno_habla=molde.turno_habla,
        cuando_habla=molde.cuando_habla,
        justi_habla=molde.justi_habla or "",
    )
    if molde.accion == "asignar":
        turno: str | None = molde.turno
        justificacion = None
    elif molde.accion == "ausencia":
        turno = None
        justificacion = molde.justificacion
    elif molde.accion == "quitar":
        turno = None
        justificacion = None
    else:
        raise RuntimeError(f"acción desconocida: {molde.accion}")
    esperado = {
        "empleado": nombre,
        "turno": turno,
        "fechas": fechas,
        "justificacion": justificacion,
        "accion": molde.accion,
    }
    return Ejemplo(
        orden=orden,
        fecha_referencia=referencia,
        esperado=esperado,
        molde_id=molde.id,
        cuando=molde.cuando,
        grupo_molde=molde.grupo,
        split="",
    )


def _validar_positivo(
    ejemplo: Ejemplo, nombres: set[str], alias: dict[str, str]
) -> None:
    etiqueta = ejemplo.esperado
    if etiqueta is None:
        raise RuntimeError("positivo sin etiqueta")
    if etiqueta["empleado"] not in nombres:
        raise RuntimeError(f"empleado fuera de la nómina: {etiqueta['empleado']}")
    if etiqueta["accion"] not in {"asignar", "ausencia", "quitar"}:
        raise RuntimeError(etiqueta["accion"])
    if etiqueta["accion"] == "asignar" and etiqueta["turno"] not in {"M", "T", "N"}:
        raise RuntimeError("asignar sin turno")
    if etiqueta["accion"] != "asignar" and etiqueta["turno"] is not None:
        raise RuntimeError("ausencia o quitar con turno")
    if etiqueta["accion"] == "ausencia" and not etiqueta["justificacion"]:
        raise RuntimeError("ausencia sin justificación")
    if etiqueta["accion"] != "ausencia" and etiqueta["justificacion"] is not None:
        raise RuntimeError("justificación inesperada")
    fechas = etiqueta["fechas"]
    if not fechas or tuple(fechas) != tuple(sorted(set(fechas))):
        raise RuntimeError(f"fechas inválidas: {fechas}")
    resueltas = tuple(
        dia.isoformat()
        for dia in resolver_fechas(ejemplo.cuando or "", ejemplo.fecha_referencia)
    )
    if resueltas != tuple(fechas):
        raise RuntimeError("la etiqueta no coincide con el resolver")
    formas = alias_de(etiqueta["empleado"], alias)
    if not any(forma in ejemplo.orden for forma in formas):
        raise RuntimeError(f"la orden no menciona a {etiqueta['empleado']}")


def _llenar_pool(
    nombres: list[str],
    alias: dict[str, str],
    rng: random.Random,
) -> list[Ejemplo]:
    cubetas: dict[str, dict[str, list[Ejemplo]]] = {
        accion: {"train": [], "val": []} for accion in CUOTAS
    }
    for molde in moldes_de("pool"):
        pares = [
            (molde, nombre)
            for nombre in nombres
            if molde.genero is None or genero_de(nombre) == molde.genero
        ]
        rng.shuffle(pares)
        for molde_par, nombre in pares:
            cuotas = CUOTAS[molde_par.accion]
            lleno = all(
                len(cubetas[molde_par.accion][parte]) >= tope
                for parte, tope in cuotas.items()
            )
            if lleno:
                break
            ejemplo = materializar(molde_par, nombre, alias)
            split = split_por_hash(ejemplo.orden)
            if len(cubetas[molde_par.accion][split]) >= cuotas[split]:
                continue
            _validar_positivo(ejemplo, set(nombres), alias)
            cubetas[molde_par.accion][split].append(
                Ejemplo(
                    orden=ejemplo.orden,
                    fecha_referencia=ejemplo.fecha_referencia,
                    esperado=ejemplo.esperado,
                    molde_id=ejemplo.molde_id,
                    cuando=ejemplo.cuando,
                    grupo_molde=ejemplo.grupo_molde,
                    split=split,
                )
            )
    salida: list[Ejemplo] = []
    for accion, cuotas in CUOTAS.items():
        for split, tope in cuotas.items():
            tiene = len(cubetas[accion][split])
            if tiene != tope:
                raise RuntimeError(f"cuota {accion}/{split}: {tiene} != {tope}")
            salida.extend(cubetas[accion][split])
    return salida


def _llenar_test(
    nombres: list[str], alias: dict[str, str], rng: random.Random
) -> list[Ejemplo]:
    por_accion: dict[str, list[list[tuple[Molde, str]]]] = defaultdict(list)
    for molde in moldes_de("test"):
        pares = [(molde, nombre) for nombre in nombres]
        rng.shuffle(pares)
        por_accion[molde.accion].append(pares)
    salida: list[Ejemplo] = []
    for accion, listas in por_accion.items():
        tomados = 0
        indice = 0
        while tomados < N_TEST_POR_ACCION:
            progreso = False
            for pares in listas:
                if indice < len(pares) and tomados < N_TEST_POR_ACCION:
                    molde, nombre = pares[indice]
                    ejemplo = materializar(molde, nombre, alias)
                    _validar_positivo(ejemplo, set(nombres), alias)
                    salida.append(
                        Ejemplo(
                            orden=ejemplo.orden,
                            fecha_referencia=ejemplo.fecha_referencia,
                            esperado=ejemplo.esperado,
                            molde_id=ejemplo.molde_id,
                            cuando=ejemplo.cuando,
                            grupo_molde="test",
                            split="test",
                        )
                    )
                    tomados += 1
                    progreso = True
            if not progreso:
                raise RuntimeError(f"faltan ejemplos de test para {accion}")
            indice += 1
    return salida


def _negativos() -> list[Ejemplo]:
    if len(NEGATIVOS) != N_NEG_TRAIN + N_NEG_VAL + N_NEG_TEST:
        raise RuntimeError("la lista de negativos no suma 40")
    ordenados = sorted(NEGATIVOS, key=_sha)
    cortes = (
        ["test"] * N_NEG_TEST + ["val"] * N_NEG_VAL + ["train"] * N_NEG_TRAIN
    )
    salida: list[Ejemplo] = []
    for texto, split in zip(ordenados, cortes, strict=True):
        numero = int(_sha(texto)[:8], 16)
        referencia = REFERENCIAS[numero % len(REFERENCIAS)]
        salida.append(
            Ejemplo(
                orden=texto,
                fecha_referencia=referencia,
                esperado=None,
                molde_id="negativo",
                cuando=None,
                grupo_molde="negativo",
                split=split,
            )
        )
    return salida


def generar_sinteticos(semilla: int = SEMILLA) -> dict[str, list[Ejemplo]]:
    """Positivos y negativos sintéticos, sin red."""
    if sum(CUOTAS[a]["train"] for a in CUOTAS) != N_TRAIN:
        raise RuntimeError("las cuotas de train no suman 350")
    if sum(CUOTAS[a]["val"] for a in CUOTAS) != N_VAL:
        raise RuntimeError("las cuotas de val no suman 50")
    nombres = cargar_nombres()
    alias = construir_alias(nombres)
    rng = random.Random(semilla)
    pool = _llenar_pool(nombres, alias, rng)
    test = _llenar_test(nombres, alias, random.Random(semilla))
    negativos = _negativos()
    splits: dict[str, list[Ejemplo]] = {"train": [], "val": [], "test": []}
    for ejemplo in pool + test + negativos:
        splits[ejemplo.split].append(ejemplo)
    _validar_splits(splits)
    return splits


def _validar_splits(splits: dict[str, list[Ejemplo]]) -> None:
    textos: dict[str, set[str]] = {}
    for split, filas in splits.items():
        ordenes = [fila.orden for fila in filas]
        if len(ordenes) != len(set(ordenes)):
            raise RuntimeError(f"órdenes repetidas en {split}")
        textos[split] = set(ordenes)
    if textos["train"] & textos["val"] or textos["train"] & textos["test"]:
        raise RuntimeError("fuga de texto entre splits")
    if textos["val"] & textos["test"]:
        raise RuntimeError("fuga de texto entre val y test")
    pool_ids = {
        fila.molde_id
        for fila in splits["train"] + splits["val"]
        if fila.grupo_molde == "pool"
    }
    test_ids = {
        fila.molde_id for fila in splits["test"] if fila.grupo_molde == "test"
    }
    if pool_ids & test_ids:
        raise RuntimeError("un molde de test también está en el pool")
    positivos = [
        fila
        for filas in splits.values()
        for fila in filas
        if fila.esperado is not None
    ]
    if len(positivos) < 450:
        raise RuntimeError(f"solo {len(positivos)} positivos")


def escribir_jsonl(ruta: Path, filas: list[Ejemplo]) -> None:
    """JSONL UTF-8 sin BOM, ordenado por el texto de la orden."""
    ordenadas = sorted(filas, key=lambda fila: fila.orden)
    lineas = [json.dumps(fila.registro(), ensure_ascii=False) for fila in ordenadas]
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text("\n".join(lineas) + "\n", encoding="utf-8", newline="\n")


def leer_jsonl(ruta: Path) -> list[dict]:
    """Lee un JSONL de órdenes."""
    filas = []
    for linea in ruta.read_text(encoding="utf-8-sig").splitlines():
        if linea.strip():
            filas.append(json.loads(linea))
    return filas


def muestra_revision(splits: dict[str, list[Ejemplo]], n: int = 30) -> list[Ejemplo]:
    """n positivos repartidos, estables al ordenar por el texto."""
    positivos = [
        fila
        for split in ("train", "val", "test")
        for fila in splits[split]
        if fila.esperado is not None
    ]
    positivos.sort(key=lambda fila: fila.orden)
    if len(positivos) < n:
        raise RuntimeError("no hay suficientes positivos para la muestra")
    paso = len(positivos) / n
    return [positivos[int(i * paso)] for i in range(n)]


def describir_muestra(ejemplo: Ejemplo) -> str:
    """Línea legible para la revisión manual."""
    if ejemplo.esperado is None:
        return f"{ejemplo.split}\tNEG\t{ejemplo.orden}"
    etiqueta = ejemplo.esperado
    fechas = ",".join(etiqueta["fechas"])
    return (
        f"{ejemplo.split}\t{ejemplo.fecha_referencia.isoformat()}\t"
        f"{etiqueta['accion']}\t{etiqueta['turno']}\t{etiqueta['justificacion']}\t"
        f"{etiqueta['empleado']}\t{fechas}\t{ejemplo.orden}"
    )


def _agregar_massive(train: list[Ejemplo]) -> str:
    from .massive import intentar_massive

    frases, mensaje = intentar_massive()
    ocupados = {fila.orden for fila in train}
    agregados = 0
    for frase in frases:
        if frase in ocupados:
            continue
        numero = int(_sha(frase)[:8], 16)
        train.append(
            Ejemplo(
                orden=frase,
                fecha_referencia=REFERENCIAS[numero % len(REFERENCIAS)],
                esperado=None,
                molde_id="massive",
                cuando=None,
                grupo_molde="massive",
                split="train",
            )
        )
        ocupados.add(frase)
        agregados += 1
    return f"{mensaje}; agregados a train: {agregados}"


def main(argv: list[str] | None = None) -> int:
    """Escribe train.jsonl, val.jsonl y test.jsonl."""
    parser = argparse.ArgumentParser(
        description="Genera el dataset de órdenes de Relevo."
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directorio de los JSONL.",
    )
    parser.add_argument(
        "--sin-massive",
        action="store_true",
        help="No intenta descargar MASSIVE es-ES.",
    )
    args = parser.parse_args(argv)
    splits = generar_sinteticos()
    if args.sin_massive:
        nota = "MASSIVE no solicitado (--sin-massive)."
    else:
        nota = _agregar_massive(splits["train"])
    print(nota)
    for nombre in ("train", "val", "test"):
        destino = args.salida / f"{nombre}.jsonl"
        escribir_jsonl(destino, splits[nombre])
        print(f"{nombre}: {len(splits[nombre])} -> {destino}")
    print("--- muestra de revisión ---")
    for ejemplo in muestra_revision(splits):
        print(describir_muestra(ejemplo))
    return 0


if __name__ == "__main__":
    sys.exit(main())
