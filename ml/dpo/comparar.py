"""Tabla base | v1 | v2, intervalos bootstrap y subgrupos. Sin maquillar."""

from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

from extractor.constantes import MODELO_BASE
from extractor.evaluar import evaluar_filas, leer_jsonl
from extractor.metricas import CAMPOS, ParEval, calcular_metricas, total_coincide

_RAIZ = Path(__file__).resolve().parents[2]
_MESES = (
    "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|"
    "octubre|noviembre|diciembre"
)
_ABSOLUTA = re.compile(rf"\b\d{{1,2}}\s+de\s+(?:{_MESES})\b", re.IGNORECASE)
_RELATIVA = re.compile(
    r"mañana|manana|pasado mañana|pasado manana|otra semana|esta semana|"
    r"\bfinde\b|puente|hoy en ocho|el lunes|el martes|el miércoles|el miercoles|"
    r"el jueves|el viernes|el sábado|el sabado|el domingo|primera semana",
    re.IGNORECASE,
)
_FILAS_TABLA = (
    ("empleado", "exactitud_empleado"),
    ("turno", "exactitud_turno"),
    ("accion", "exactitud_accion"),
    ("justificacion", "exactitud_justificacion"),
    ("fechas (F1)", "f1_fechas"),
    ("JSON válido", "json_valido"),
    ("exactitud total", "exactitud_total"),
)
_FILAS_SUBGRUPO = (
    ("exactitud total", "exactitud_total"),
    ("accion", "exactitud_accion"),
    ("fechas (F1)", "f1_fechas"),
)


def clase_fecha(orden: str) -> str:
    """absoluta, relativa o sin_fecha, a partir del texto de la orden."""
    if _ABSOLUTA.search(orden):
        return "absoluta"
    if _RELATIVA.search(orden):
        return "relativa"
    return "sin_fecha"


def es_quitar(fila: dict) -> bool:
    """True si la etiqueta dorada pide quitar el turno."""
    esperado = fila.get("esperado")
    return isinstance(esperado, dict) and esperado.get("accion") == "quitar"


def aciertos_totales(detalle: list[dict]) -> list[bool]:
    """Un booleano por ejemplo: la extracción cuadra completa."""
    return [
        total_coincide(ParEval(fila["esperado"], fila["prediccion"], fila["json_ok"]))
        for fila in detalle
    ]


def intervalo_bootstrap(
    aciertos: list[bool],
    remuestreos: int = 1000,
    semilla: int = 42,
) -> dict:
    """IC percentil 95 % de la media. La media muestral cabe en el intervalo."""
    if not aciertos:
        raise ValueError("no hay ejemplos para el intervalo")
    if remuestreos < 2:
        raise ValueError("hacen falta al menos 2 remuestreos")
    n = len(aciertos)
    rng = random.Random(semilla)
    medias = []
    for _ in range(remuestreos):
        suma = 0
        for _ in range(n):
            if aciertos[rng.randrange(n)]:
                suma += 1
        medias.append(suma / n)
    medias.sort()
    bajo = medias[int(0.025 * (remuestreos - 1))]
    alto = medias[int(0.975 * (remuestreos - 1))]
    media = sum(1 for valor in aciertos if valor) / n
    return {
        "media": media,
        "bajo": bajo,
        "alto": alto,
        "remuestreos": remuestreos,
        "semilla": semilla,
    }


def metricas_de_detalle(detalle: list[dict]) -> dict | None:
    """Métricas de un subconjunto. None si está vacío."""
    if not detalle:
        return None
    pares = [
        ParEval(fila["esperado"], fila["prediccion"], fila["json_ok"])
        for fila in detalle
    ]
    return calcular_metricas(pares)


def partir_subgrupos(filas: list[dict], detalle: list[dict]) -> dict[str, list[dict]]:
    """Reparte el detalle en fecha relativa/absoluta y en quitar/resto."""
    grupos: dict[str, list[dict]] = {
        "relativa": [],
        "absoluta": [],
        "sin_fecha": [],
        "quitar": [],
        "resto": [],
    }
    for fila, item in zip(filas, detalle, strict=True):
        grupos[clase_fecha(fila["orden"])].append(item)
        if es_quitar(fila):
            grupos["quitar"].append(item)
        else:
            grupos["resto"].append(item)
    return grupos


def _pct(valor: float) -> str:
    return f"{valor * 100:.2f} %"


def _pp(valor: float) -> str:
    return f"{valor * 100:+.2f} pp"


def hipotesis(delta_total: float) -> str:
    """Lectura honesta del delta de exactitud total."""
    if delta_total > 0.005:
        return "v2 sube la exactitud total en el test congelado."
    if delta_total < -0.005:
        return (
            "v2 baja la exactitud total. Hipótesis: poca señal de corrección, "
            "sobreajuste a los moldes simulados, o beta 0.1 alto para el tamaño "
            "del lote."
        )
    return (
        "v2 queda en empate práctico con v1. Hipótesis: la señal no mueve la "
        "exactitud total, o lo que gana en un subgrupo lo pierde en otro."
    )


def _celda(metricas: dict | None, clave: str, pendiente: bool) -> str:
    if pendiente:
        return "pendiente"
    if metricas is None:
        return "—"
    return _pct(float(metricas[clave]))


def tabla_comparacion(
    versiones: dict[str, dict | None],
    intervalos: dict[str, dict | None],
    subgrupos: dict[str, dict[str, dict | None]],
    grok_pendiente: bool,
) -> str:
    """Markdown con la tabla única, los intervalos y los subgrupos."""
    orden = ("base", "v1", "v2")
    lineas = [
        "| métrica | base | v1 | v2 | delta v1→v2 | Grok |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for nombre, clave in _FILAS_TABLA:
        base = versiones["base"]
        v1 = versiones["v1"]
        v2 = versiones["v2"]
        delta = "—"
        if v1 is not None and v2 is not None:
            delta = _pp(float(v2[clave]) - float(v1[clave]))
        grok = _celda(versiones.get("grok"), clave, grok_pendiente)
        lineas.append(
            "| "
            + " | ".join(
                (
                    nombre,
                    _celda(base, clave, False),
                    _celda(v1, clave, False),
                    _celda(v2, clave, False),
                    delta,
                    grok,
                )
            )
            + " |"
        )
    lineas.append("")
    lineas.append("## Intervalos de la exactitud total")
    lineas.append("")
    lineas.append("| versión | exactitud total | IC 95 % (bootstrap) |")
    lineas.append("|---|---:|---:|")
    for nombre in (*orden, "grok"):
        if nombre == "grok" and grok_pendiente:
            lineas.append("| Grok | pendiente | pendiente |")
            continue
        intervalo = intervalos.get(nombre)
        if intervalo is None:
            continue
        etiqueta = "Grok" if nombre == "grok" else nombre
        ic = f"[{_pct(intervalo['bajo'])}, {_pct(intervalo['alto'])}]"
        lineas.append(f"| {etiqueta} | {_pct(intervalo['media'])} | {ic} |")
    lineas.append("")
    lineas.append(
        f"Remuestreos: {next(iter(intervalos.values()))['remuestreos']}. "
        "El intervalo es el percentil 2.5–97.5 de la media."
    )
    titulos = {
        "relativa": "Fechas relativas",
        "absoluta": "Fechas absolutas",
        "sin_fecha": "Sin fecha en la orden",
        "quitar": "Acción quitar",
        "resto": "Resto (no quitar)",
    }
    for clave, titulo in titulos.items():
        por_version = subgrupos.get(clave, {})
        referencia = por_version.get("v1") or por_version.get("base")
        if referencia is None:
            continue
        lineas.append("")
        lineas.append(f"## {titulo} (n = {referencia['n']})")
        lineas.append("")
        lineas.append("| métrica | base | v1 | v2 | delta v1→v2 |")
        lineas.append("|---|---:|---:|---:|---:|")
        for nombre, metrica in _FILAS_SUBGRUPO:
            v1 = por_version.get("v1")
            v2 = por_version.get("v2")
            delta = "—"
            if v1 is not None and v2 is not None:
                delta = _pp(float(v2[metrica]) - float(v1[metrica]))
            lineas.append(
                "| "
                + " | ".join(
                    (
                        nombre,
                        _celda(por_version.get("base"), metrica, False),
                        _celda(v1, metrica, False),
                        _celda(v2, metrica, False),
                        delta,
                    )
                )
                + " |"
            )
    delta_total = 0.0
    if versiones["v1"] is not None and versiones["v2"] is not None:
        delta_total = float(versiones["v2"]["exactitud_total"]) - float(
            versiones["v1"]["exactitud_total"]
        )
    lineas.append("")
    lineas.append("## Lectura")
    lineas.append("")
    lineas.append(hipotesis(delta_total))
    lineas.append("")
    return "\n".join(lineas)


def _liberar_gpu() -> None:
    """Suelta la caché de CUDA entre una versión y la siguiente."""
    import gc

    import torch

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def _evaluar_local(filas: list[dict], adapter: Path | None, modelo_id: str) -> dict:
    from extractor.evaluar import cargar_extractor, generar_extraccion

    modelo, tokenizer = cargar_extractor(adapter, modelo_id)

    def completar(fila: dict) -> str:
        return generar_extraccion(modelo, tokenizer, fila)

    return evaluar_filas(filas, completar)


def _evaluar_xai(filas: list[dict]) -> dict | None:
    from extractor.evaluar import clave_xai, completar_xai
    from extractor.prompt import construir_mensajes

    if not clave_xai():
        return None

    def completar(fila: dict) -> str:
        return completar_xai(construir_mensajes(fila, False))

    return evaluar_filas(filas, completar)


def _bloque(filas: list[dict], resultado: dict) -> dict:
    detalle = resultado["predicciones"]
    return {
        "metricas": resultado["metricas"],
        "detalle": detalle,
        "subgrupos": {
            nombre: metricas_de_detalle(grupo)
            for nombre, grupo in partir_subgrupos(filas, detalle).items()
        },
        "aciertos": aciertos_totales(detalle),
    }


def comparar(args: argparse.Namespace) -> dict:
    """Evalúa base, v1 y v2 sobre el mismo test y escribe md + json."""
    filas = leer_jsonl(args.test)
    if args.limite > 0:
        filas = filas[: args.limite]
    corridas = {}
    for nombre, adapter in (
        ("base", None),
        ("v1", args.adapter_v1),
        ("v2", args.adapter_v2),
    ):
        corridas[nombre] = _bloque(
            filas, _evaluar_local(filas, adapter, args.modelo)
        )
        _liberar_gpu()
    grok = _evaluar_xai(filas)
    if grok is not None:
        corridas["grok"] = _bloque(filas, grok)
    versiones = {nombre: corrida["metricas"] for nombre, corrida in corridas.items()}
    if "grok" not in versiones:
        versiones["grok"] = None
    intervalos = {
        nombre: intervalo_bootstrap(corrida["aciertos"], args.remuestreos, args.semilla)
        for nombre, corrida in corridas.items()
    }
    subgrupos: dict[str, dict[str, dict | None]] = {}
    for nombre, corrida in corridas.items():
        for grupo, metricas in corrida["subgrupos"].items():
            subgrupos.setdefault(grupo, {})[nombre] = metricas
    pendiente = "grok" not in corridas
    markdown = tabla_comparacion(versiones, intervalos, subgrupos, pendiente)
    if pendiente:
        markdown += (
            "\nSin XAI_API_KEY: la columna Grok queda pendiente. "
            "No es un error de gate.\n"
        )
    payload = {
        "n": len(filas),
        "modelo": args.modelo,
        "versiones": {
            nombre: corrida["metricas"] for nombre, corrida in corridas.items()
        },
        "intervalos": intervalos,
        "subgrupos": subgrupos,
        "grok_pendiente": pendiente,
        "campos": list(CAMPOS),
    }
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    destino_md = args.salida.with_suffix(".md")
    destino_md.write_text(markdown, encoding="utf-8", newline="\n")
    print(markdown)
    if pendiente:
        print("Sin XAI_API_KEY: se omite el proveedor xai. No es un error de gate.")
    print(f"json: {args.salida}")
    return payload


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos de la comparación."""
    parser = argparse.ArgumentParser(
        description="Compara base, LoRA v1 y DPO v2 en el test congelado."
    )
    parser.add_argument(
        "--test",
        type=Path,
        default=_RAIZ / "data" / "ordenes" / "test.jsonl",
    )
    parser.add_argument(
        "--adapter-v1",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v1",
    )
    parser.add_argument(
        "--adapter-v2",
        type=Path,
        default=_RAIZ / "ml" / "models" / "extractor-v2",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=_RAIZ / "ml" / "runs" / "comparacion.json",
    )
    parser.add_argument("--modelo", default=MODELO_BASE)
    parser.add_argument("--remuestreos", type=int, default=1000)
    parser.add_argument("--semilla", type=int, default=42)
    parser.add_argument("--limite", type=int, default=0)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Escribe la comparación. Sin clave xAI sale 0."""
    comparar(parser_cli().parse_args(argv))
    return 0
