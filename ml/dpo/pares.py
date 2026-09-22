"""Pares de `pares_preferencia` al formato {prompt, chosen, rejected} de TRL."""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from extractor.metricas import ParEval, total_coincide
from extractor.parser import parsear_extraccion
from extractor.prompt import construir_mensajes, serializar_respuesta

_RAIZ = Path(__file__).resolve().parents[2]
_BOGOTA = ZoneInfo("America/Bogota")
_URL_DEFAULT = "postgresql://relevo:relevo@localhost:5432/relevo"
_MARCA = re.compile(
    r"^\[simulador fecha_referencia=(\d{4}-\d{2}-\d{2})\]\n(.*)\Z",
    re.DOTALL,
)
_CLAVES = ("empleado", "turno", "fechas", "justificacion", "accion")


def marcar_orden(orden: str, fecha_referencia: str) -> str:
    """Texto que distingue una orden simulada y conserva su fecha."""
    return f"[simulador fecha_referencia={fecha_referencia}]\n{orden}"


def fecha_bogota(instante: datetime) -> str:
    """Día civil en America/Bogota."""
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=ZoneInfo("UTC"))
    return instante.astimezone(_BOGOTA).date().isoformat()


def interpretar_prompt(prompt_texto: str, creado_en: datetime) -> tuple[str, str, str]:
    """Orden, fecha de referencia y marca (simulador o humana)."""
    coincidencia = _MARCA.match(prompt_texto)
    if coincidencia:
        return coincidencia.group(2), coincidencia.group(1), "simulador"
    return prompt_texto, fecha_bogota(creado_en), "humana"


def url_base() -> str:
    """DATABASE_URL del entorno o de .env. No la imprime."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    ruta = _RAIZ / ".env"
    if ruta.is_file():
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            limpia = linea.strip()
            if not limpia or limpia.startswith("#") or "=" not in limpia:
                continue
            clave, valor = limpia.split("=", 1)
            if clave.strip() == "DATABASE_URL":
                secreto = valor.strip().strip('"').strip("'")
                if secreto:
                    return secreto
    return _URL_DEFAULT


def normalizar_extraccion(valor) -> dict | None:
    """Contrato de cinco claves, o None si no hay extracción válida."""
    if valor is None:
        return None
    if isinstance(valor, str):
        parseo = parsear_extraccion(valor)
        return parseo["valor"] if parseo["ok"] else None
    if not isinstance(valor, dict):
        return None
    if not all(clave in valor for clave in _CLAVES):
        return None
    candidato = {clave: valor[clave] for clave in _CLAVES}
    texto = json.dumps(candidato, ensure_ascii=False)
    parseo = parsear_extraccion(texto)
    if not parseo["ok"]:
        return None
    return parseo["valor"]


def equivalentes(izquierda, derecha) -> bool:
    """True si las dos extracciones dicen lo mismo, null incluido."""
    una = normalizar_extraccion(izquierda)
    otra = normalizar_extraccion(derecha)
    if una is None and otra is None:
        return True
    if una is None or otra is None:
        return False
    return total_coincide(ParEval(una, otra, True))


def _mensajes(orden: str, fecha: str, esperado: dict | None, con_respuesta: bool):
    fila = {"orden": orden, "fecha_referencia": fecha, "esperado": esperado}
    return construir_mensajes(fila, con_respuesta)


@dataclass
class ResultadoPares:
    """Lo exportable y los conteos para el reporte."""

    dpo: list[dict] = field(default_factory=list)
    sft: list[dict] = field(default_factory=list)
    conteos: dict = field(default_factory=dict)


def ejemplos_desde_filas(
    filas: list[dict],
    incluir_aprobaciones: bool = False,
) -> ResultadoPares:
    """Filtra aprobaciones limpias e iguales. El resto queda en formato TRL."""
    por_origen: Counter[str] = Counter()
    por_marca: Counter[str] = Counter()
    descartados = 0
    resultado = ResultadoPares()
    for fila in filas:
        origen = str(fila["origen"])
        por_origen[origen] += 1
        orden, fecha, marca = interpretar_prompt(
            fila["prompt_texto"], fila["creado_en"]
        )
        if fila.get("usuario") == "simulador":
            marca = "simulador"
        por_marca[marca] += 1
        if fila["rechazada"] is None:
            if incluir_aprobaciones:
                elegida = normalizar_extraccion(fila["elegida"])
                resultado.sft.append(
                    {
                        "messages": _mensajes(orden, fecha, elegida, True),
                        "chat_template_kwargs": {"enable_thinking": False},
                        "origen": origen,
                        "marca": marca,
                    }
                )
            continue
        if equivalentes(fila["elegida"], fila["rechazada"]):
            descartados += 1
            continue
        elegida = normalizar_extraccion(fila["elegida"])
        rechazada = normalizar_extraccion(fila["rechazada"])
        resultado.dpo.append(
            {
                "prompt": _mensajes(orden, fecha, None, False),
                "chosen": [
                    {
                        "role": "assistant",
                        "content": serializar_respuesta(elegida),
                    }
                ],
                "rejected": [
                    {
                        "role": "assistant",
                        "content": serializar_respuesta(rechazada),
                    }
                ],
                "chat_template_kwargs": {"enable_thinking": False},
                "origen": origen,
                "marca": marca,
            }
        )
    resultado.conteos = {
        "leidos": len(filas),
        "por_origen": dict(sorted(por_origen.items())),
        "por_marca": dict(sorted(por_marca.items())),
        "descartados_iguales": descartados,
        "dpo": len(resultado.dpo),
        "sft": len(resultado.sft),
    }
    return resultado


def escribir_jsonl(ruta: Path, filas: list[dict]) -> None:
    """JSONL UTF-8 sin BOM."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    lineas = [json.dumps(fila, ensure_ascii=False) for fila in filas]
    texto = ("\n".join(lineas) + "\n") if lineas else ""
    ruta.write_text(texto, encoding="utf-8", newline="\n")


def leer_pares(url: str | None = None) -> list[dict]:
    """Lee pares con el rol lector. No imprime la URL."""
    import psycopg
    from psycopg.rows import dict_row

    consulta = """
        SELECT
            pp.prompt_texto,
            pp.elegida,
            pp.rechazada,
            pp.origen,
            pp.creado_en,
            pr.usuario
        FROM pares_preferencia AS pp
        JOIN propuestas AS pr ON pr.id = pp.propuesta_id
        ORDER BY pp.id
    """
    with psycopg.connect(url or url_base()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SET ROLE relevo_lector")
            cur.execute(consulta)
            return list(cur.fetchall())


def exportar(args: argparse.Namespace) -> ResultadoPares:
    """Lee la base y escribe el JSONL de DPO (y el SFT si se pidió)."""
    filas = leer_pares(args.url)
    resultado = ejemplos_desde_filas(filas, args.incluir_aprobaciones)
    escribir_jsonl(args.salida, resultado.dpo)
    if args.incluir_aprobaciones:
        escribir_jsonl(args.sft, resultado.sft)
    print(json.dumps(resultado.conteos, ensure_ascii=False, indent=2))
    print(f"dpo: {args.salida}")
    return resultado


def parser_cli() -> argparse.ArgumentParser:
    """Argumentos del exportador."""
    parser = argparse.ArgumentParser(
        description="Exporta pares_preferencia al formato DPO de TRL."
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=_RAIZ / "ml" / "runs" / "pares_dpo.jsonl",
    )
    parser.add_argument(
        "--sft",
        type=Path,
        default=_RAIZ / "ml" / "runs" / "pares_sft.jsonl",
    )
    parser.add_argument("--incluir-aprobaciones", action="store_true")
    parser.add_argument("--url", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Punto de entrada. Sale 0 aunque no haya pares."""
    exportar(parser_cli().parse_args(argv))
    return 0
