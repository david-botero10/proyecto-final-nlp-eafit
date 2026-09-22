"""Decisiones simuladas de LoRA v1 sobre órdenes nuevas. Semilla 42.

No escribe nómina. Solo propuestas, aprobaciones y pares_preferencia,
con usuario «simulador».
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

_ORDENES = Path(__file__).resolve().parent
_DATA = _ORDENES.parent
_RAIZ = _DATA.parent
_ML = _RAIZ / "ml"
for _ruta in (_DATA, _ML):
    if str(_ruta) not in sys.path:
        sys.path.insert(0, str(_ruta))

from dpo.pares import escribir_jsonl, marcar_orden, url_base
from extractor.constantes import MODELO_BASE
from extractor.metricas import ParEval, total_coincide
from extractor.parser import parsear_extraccion
from extractor.prompt import ORDENES_FEWSHOT

from ordenes.generar_ordenes import leer_jsonl, materializar
from ordenes.nomina import cargar_nombres, construir_alias, genero_de
from ordenes.plantillas import moldes_de


def ordenes_ocupadas() -> set[str]:
    """Textos ya usados en train, val, test o en el few-shot del prompt."""
    ocupadas = set(ORDENES_FEWSHOT)
    for nombre in ("train", "val", "test"):
        for fila in leer_jsonl(_ORDENES / f"{nombre}.jsonl"):
            ocupadas.add(fila["orden"])
    return ocupadas


def ordenes_nuevas(n: int = 120, semilla: int = 42) -> list[dict]:
    """Hasta n órdenes de moldes de test que no están en los splits."""
    nombres = cargar_nombres()
    alias = construir_alias(nombres)
    ocupadas = ordenes_ocupadas()
    candidatas = []
    for molde in moldes_de("test"):
        for nombre in nombres:
            if molde.genero is not None and genero_de(nombre) != molde.genero:
                continue
            ejemplo = materializar(molde, nombre, alias)
            if ejemplo.orden in ocupadas:
                continue
            registro = ejemplo.registro()
            registro["molde_id"] = ejemplo.molde_id
            candidatas.append(registro)
    rng = random.Random(semilla)
    rng.shuffle(candidatas)
    if len(candidatas) < n:
        raise RuntimeError(
            f"solo hay {len(candidatas)} órdenes nuevas y se pidieron {n}"
        )
    elegidas = candidatas[:n]
    elegidas.sort(key=lambda fila: fila["orden"])
    return elegidas


def clasificar(esperado, crudo: str) -> dict:
    """Aprobación si v1 acierta; corrección si la predicción difiere."""
    parseo = parsear_extraccion(crudo)
    coincide = total_coincide(
        ParEval(
            esperado=esperado,
            prediccion=parseo["valor"],
            json_ok=parseo["ok"],
        )
    )
    if coincide:
        return {
            "origen": "aprobacion",
            "elegida": esperado,
            "rechazada": None,
            "prediccion": parseo["valor"],
            "json_ok": parseo["ok"],
        }
    return {
        "origen": "correccion",
        "elegida": esperado,
        "rechazada": parseo["valor"],
        "prediccion": parseo["valor"],
        "json_ok": parseo["ok"],
    }


def decidir_fila(fila: dict, crudo: str) -> dict:
    """Une la orden nueva con la decisión simulada."""
    return {
        "orden": fila["orden"],
        "fecha_referencia": fila["fecha_referencia"],
        "esperado": fila["esperado"],
        "molde_id": fila.get("molde_id"),
        **clasificar(fila["esperado"], crudo),
    }


def resumir(decisiones: list[dict]) -> dict:
    """Conteos y una muestra de correcciones: esa es la señal de v1."""
    por_origen = Counter(fila["origen"] for fila in decisiones)
    por_molde = Counter((fila.get("molde_id") or "") for fila in decisiones)
    correcciones = [fila for fila in decisiones if fila["origen"] == "correccion"]
    return {
        "n": len(decisiones),
        "por_origen": dict(sorted(por_origen.items())),
        "correcciones_v1": len(correcciones),
        "por_molde": dict(sorted(por_molde.items())),
        "ejemplos_correccion": [
            {
                "orden": fila["orden"],
                "fecha_referencia": fila["fecha_referencia"],
                "esperado": fila["esperado"],
                "prediccion": fila["prediccion"],
            }
            for fila in correcciones[:8]
        ],
    }


def insertar_decisiones(decisiones: list[dict], url: str | None = None) -> int:
    """Reemplaza las filas del simulador. No toca empleados ni turnos."""
    import psycopg
    from psycopg.types.json import Json

    with psycopg.connect(url or url_base()) as conn, conn.cursor() as cur:
        cur.execute(
            """
                DELETE FROM pares_preferencia
                WHERE propuesta_id IN (
                    SELECT id FROM propuestas WHERE usuario = 'simulador'
                )
                """
        )
        cur.execute(
            """
                DELETE FROM aprobaciones
                WHERE propuesta_id IN (
                    SELECT id FROM propuestas WHERE usuario = 'simulador'
                )
                """
        )
        cur.execute("DELETE FROM propuestas WHERE usuario = 'simulador'")
        cur.execute("SET LOCAL ROLE relevo_escritor")
        for fila in decisiones:
            marcado = marcar_orden(fila["orden"], fila["fecha_referencia"])
            if fila["origen"] == "aprobacion":
                estado, decision = "aprobada", "aprobar"
            elif fila["origen"] == "correccion":
                estado, decision = "corregida", "corregir"
            else:
                raise RuntimeError(f"origen no simulado: {fila['origen']}")
            prediccion = fila["prediccion"]
            cur.execute(
                """
                    INSERT INTO propuestas (
                        usuario, orden_texto, extraccion, estado, decidido_en
                    )
                    VALUES ('simulador', %s, %s, %s, now())
                    RETURNING id
                    """,
                (
                    marcado,
                    Json(prediccion) if prediccion is not None else None,
                    estado,
                ),
            )
            propuesta_id = cur.fetchone()[0]
            cur.execute(
                """
                    INSERT INTO aprobaciones (propuesta_id, usuario, decision)
                    VALUES (%s, 'simulador', %s)
                    """,
                (propuesta_id, decision),
            )
            elegida = fila["elegida"]
            rechazada = fila["rechazada"]
            cur.execute(
                """
                    INSERT INTO pares_preferencia (
                        propuesta_id, prompt_texto, elegida, rechazada, origen
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                (
                    propuesta_id,
                    marcado,
                    Json(elegida) if elegida is not None else None,
                    Json(rechazada) if rechazada is not None else None,
                    fila["origen"],
                ),
            )
    return len(decisiones)


def completar_con_lora(adapter: Path, modelo_id: str):
    """Cierra sobre el modelo v1. Hay que tener CUDA."""
    import torch
    from extractor.evaluar import generar_extraccion
    from extractor.modelo import cargar_4bit
    from peft import PeftModel

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA no está disponible; la simulación con LoRA v1 exige la GPU local"
        )
    modelo, tokenizer = cargar_4bit(modelo_id)
    modelo = PeftModel.from_pretrained(modelo, str(adapter))
    modelo.eval()

    def completar(fila: dict) -> str:
        return generar_extraccion(modelo, tokenizer, fila)

    return completar


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos del simulador."""
    parser = argparse.ArgumentParser(
        description="Simula decisiones humanas a partir de LoRA v1."
    )
    parser.add_argument("--n", type=int, default=120)
    parser.add_argument("--semilla", type=int, default=42)
    parser.add_argument("--limite", type=int, default=0)
    parser.add_argument("--modelo", default=MODELO_BASE)
    parser.add_argument(
        "--adapter",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v1",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=_ORDENES / "decisiones_simuladas.jsonl",
    )
    parser.add_argument("--sin-bd", action="store_true")
    parser.add_argument("--url", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Escribe el JSONL y, salvo --sin-bd, lo inserta."""
    args = parser_cli().parse_args(argv)
    filas = ordenes_nuevas(args.n, args.semilla)
    if args.limite > 0:
        filas = filas[: args.limite]
    completar = completar_con_lora(args.adapter, args.modelo)
    decisiones = []
    for indice, fila in enumerate(filas, start=1):
        decisiones.append(decidir_fila(fila, completar(fila)))
        if indice % 10 == 0 or indice == len(filas):
            print(f"simuladas {indice}/{len(filas)}", flush=True)
    escribir_jsonl(args.salida, decisiones)
    resumen = resumir(decisiones)
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    print(f"jsonl: {args.salida}")
    if not args.sin_bd:
        print(f"insertadas: {insertar_decisiones(decisiones, args.url)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
