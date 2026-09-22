"""Corre base | v1 | v2 (y Grok si hay clave) y redacta el análisis."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

_RAIZ = Path(__file__).resolve().parents[1]
_SALIDA = _RAIZ / "evaluacion" / "resultados" / "extraccion.json"
_INFORME = _RAIZ / "evaluacion" / "extraccion.md"


def _adapter(nombre: str) -> Path:
    local = _RAIZ / "ml" / "models" / nombre
    if (local / "adapter_config.json").is_file():
        return local
    hermano = _RAIZ.parent / "e2-dpo" / "ml" / "models" / nombre
    if (hermano / "adapter_config.json").is_file():
        return hermano
    raise SystemExit(
        f"No está {nombre}/adapter_config.json en ml/models ni en ../e2-dpo."
    )


def _pct(valor: float) -> str:
    return f"{valor * 100:.2f} %"


def _pp(valor: float) -> str:
    return f"{valor * 100:+.2f} pp"


def _solapan(izquierdo: dict, derecho: dict) -> bool:
    return izquierdo["alto"] >= derecho["bajo"] and derecho["alto"] >= izquierdo["bajo"]


_ETIQUETA_GRUPO = {
    "quitar": "Quitar",
    "resto": "Resto",
    "relativa": "Fechas relativas",
    "absoluta": "Fechas absolutas",
    "sin_fecha": "Sin fecha en la orden",
}


def _grupo(payload: dict, nombre: str) -> str:
    metricas = payload["subgrupos"].get(nombre, {})
    v1 = metricas.get("v1")
    v2 = metricas.get("v2")
    base = metricas.get("base")
    etiqueta = _ETIQUETA_GRUPO.get(nombre, nombre)
    if not v1 or not v2 or not base:
        return f"{etiqueta}: sin datos."
    n = int(v2.get("n") or v1.get("n") or 0)
    return (
        f"{etiqueta} (n={n}): total {_pct(base['exactitud_total'])} → "
        f"{_pct(v1['exactitud_total'])} → {_pct(v2['exactitud_total'])} "
        f"({_pp(v2['exactitud_total'] - v1['exactitud_total'])}); "
        f"acción {_pct(v1['exactitud_accion'])} → {_pct(v2['exactitud_accion'])}; "
        f"F1 de fechas {_pct(v1['f1_fechas'])} → {_pct(v2['f1_fechas'])}."
    )


def parrafos(payload: dict) -> list[str]:
    """Tres párrafos a partir de los números de la corrida, sin maquillar."""
    versiones = payload["versiones"]
    intervalos = payload["intervalos"]
    n = int(payload["n"])
    base = versiones["base"]["exactitud_total"]
    v1 = versiones["v1"]["exactitud_total"]
    v2 = versiones["v2"]["exactitud_total"]
    delta = v2 - v1
    ic_v1 = intervalos["v1"]
    ic_v2 = intervalos["v2"]
    solapan = _solapan(ic_v1, ic_v2)
    lectura_ic = (
        "Los intervalos de v1 y v2 se solapan, así que el delta no queda "
        "separado del ruido de remuestreo."
        if solapan
        else "Los intervalos de v1 y v2 no se solapan: el delta sale del ruido de remuestreo."
    )
    if payload.get("grok_pendiente"):
        grok = (
            "Grok queda pendiente: no había XAI_API_KEY en el entorno ni en .env. "
            "La misma corrida llena la columna cuando la clave existe."
        )
    else:
        grok_total = versiones["grok"]["exactitud_total"]
        grok = (
            f"Grok, en el mismo test, queda en {_pct(grok_total)} "
            f"({_pp(grok_total - v2)} frente a v2)."
        )
    primero = (
        f"En el test congelado (n={n}) la exactitud total pasa de {_pct(base)} "
        f"en el modelo base a {_pct(v1)} con LoRA v1 y a {_pct(v2)} con DPO v2 "
        f"({_pp(delta)} de v1 a v2). El IC 95 % bootstrap de v1 es "
        f"[{_pct(ic_v1['bajo'])}, {_pct(ic_v1['alto'])}] y el de v2 es "
        f"[{_pct(ic_v2['bajo'])}, {_pct(ic_v2['alto'])}]. {lectura_ic} {grok}"
    )
    segundo = (
        "El movimiento no es parejo. "
        + " ".join(
            _grupo(payload, nombre)
            for nombre in ("quitar", "resto", "relativa", "absoluta", "sin_fecha")
        )
        + " Donde v2 gana de verdad es en quitar: ahí la acción se corrige y la "
        "exactitud total sube. En el resto la exactitud total casi no se mueve. "
        "La F1 de fechas se queda quieta en los subgrupos grandes: el DPO cambió "
        "la acción, no el calendario. En las fechas absolutas el n es chico; "
        "aunque la acción mejore, la exactitud total puede seguir en cero porque "
        "la fecha sigue mal."
    )
    tercero = (
        "Con este n no se puede decir que v2 ya sea el extractor que hay que "
        "desplegar por encima de v1 en todos los campos. Empleado y turno ya "
        f"estaban en {_pct(versiones['v1']['exactitud_empleado'])} y "
        f"{_pct(versiones['v1']['exactitud_turno'])} en v1; el JSON válido de v2 "
        f"es {_pct(versiones['v2']['json_valido'])}. "
        + (
            "La pregunta del proyecto (afinado frente a Grok) sigue abierta "
            "mientras la columna Grok esté pendiente."
            if payload.get("grok_pendiente")
            else "Grok ya está en la misma tabla: el juicio es si el afinado la alcanza en este n."
        )
        + " Los pesos no van en el repo: el script usa ml/models si el adapter "
        "está, y si no el worktree hermano e2-dpo."
    )
    return [primero, segundo, tercero]


def _correr(adapter_v1: Path, adapter_v2: Path) -> None:
    _SALIDA.parent.mkdir(parents=True, exist_ok=True)
    comando = [
        sys.executable,
        "-u",
        str(_RAIZ / "ml" / "comparar_versiones.py"),
        "--adapter-v1",
        str(adapter_v1),
        "--adapter-v2",
        str(adapter_v2),
        "--salida",
        str(_SALIDA),
    ]
    subprocess.run(comando, cwd=_RAIZ, check=True)


def redactar_informe(payload: dict) -> str:
    """Informe con la tabla que ya escribió comparar_versiones y tres párrafos."""
    tabla = _SALIDA.with_suffix(".md").read_text(encoding="utf-8")
    analisis = "\n\n".join(parrafos(payload))
    return (
        "# Métrica 1 — exactitud de extracción\n\n"
        "Reutiliza `ml/comparar_versiones.py` sobre `data/ordenes/test.jsonl`. "
        "Orden: base, LoRA v1, DPO v2 y, si hay clave, Grok (`--proveedor` no hace "
        "falta: la comparación llama a xAI sola). Intervalos: 1000 remuestreos, "
        "semilla 42, percentil 2.5–97.5.\n\n"
        f"{tabla}\n"
        "## Análisis\n\n"
        f"{analisis}\n"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--solo-redactar",
        action="store_true",
        help="No reevalúa: redacta extraccion.md desde el JSON ya escrito.",
    )
    args = parser.parse_args(argv)
    if not args.solo_redactar:
        _correr(_adapter("extractor-v1"), _adapter("extractor-v2"))
    payload = json.loads(_SALIDA.read_text(encoding="utf-8"))
    texto = redactar_informe(payload)
    _INFORME.write_text(texto, encoding="utf-8", newline="\n")
    print(texto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
