"""Descarga idempotente de fuentes y manifiesto con SHA-256."""

from __future__ import annotations

import hashlib
import json
import ssl
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from corpus_lib.constantes import USER_AGENT
from corpus_lib.modelos import Fuente

INTENTOS = 3
PAUSA_BASE_S = 1.5


def sha256_bytes(contenido: bytes) -> str:
    """Hash hexadecimal estable de un bloque de bytes."""
    return hashlib.sha256(contenido).hexdigest()


def sha256_archivo(ruta: Path) -> str:
    """Hash hexadecimal del archivo en disco."""
    return sha256_bytes(ruta.read_bytes())


def leer_manifiesto(ruta: Path) -> list[dict[str, Any]]:
    """Lee manifiesto.json o devuelve lista vacía."""
    if not ruta.exists():
        return []
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    if not isinstance(datos, list):
        raise ValueError(f"manifiesto inválido: {ruta}")
    return datos


def escribir_manifiesto(ruta: Path, entradas: list[dict[str, Any]]) -> None:
    """Escribe el manifiesto en UTF-8 sin BOM."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(entradas, ensure_ascii=False, indent=2) + "\n"
    ruta.write_text(texto, encoding="utf-8")


def indice_manifiesto(
    entradas: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Indexa el manifiesto por id de fuente."""
    return {e["id"]: e for e in entradas if "id" in e}


def extension_fuente(fuente: Fuente) -> str:
    """Extensión del archivo crudo según el formato."""
    return "pdf" if fuente.formato == "pdf" else "html"


def ruta_crudo(directorio: Path, fuente: Fuente) -> Path:
    """Ruta corpus/raw/<id>.<ext>."""
    return directorio / f"{fuente.id}.{extension_fuente(fuente)}"


def debe_descargar(
    path: Path,
    previa: dict[str, Any] | None,
    *,
    forzar: bool,
) -> bool:
    """True si hay que volver a pedir la URL.

    Si el hash del manifiesto ya existe y coincide con el archivo, no se
    redescarga (salvo --forzar).
    """
    if forzar:
        return True
    if previa is None or not path.exists():
        return True
    hash_previo = previa.get("sha256")
    if not hash_previo:
        return True
    return sha256_archivo(path) != hash_previo


def _contexto_ssl() -> ssl.SSLContext:
    """Usa el almacén del sistema (Windows); certifi omite CAs locales."""
    ctx = ssl.create_default_context()
    ctx.load_default_certs(ssl.Purpose.SERVER_AUTH)
    return ctx


def _get_con_reintentos(url: str, timeout: float = 60.0) -> httpx.Response:
    headers = {"User-Agent": USER_AGENT}
    ultimo: Exception | None = None
    verify = _contexto_ssl()
    for intento in range(INTENTOS):
        try:
            with httpx.Client(
                follow_redirects=True,
                timeout=timeout,
                headers=headers,
                verify=verify,
            ) as cliente:
                resp = cliente.get(url)
                resp.raise_for_status()
                return resp
        except httpx.HTTPError as exc:
            ultimo = exc
            time.sleep(PAUSA_BASE_S * (intento + 1))
    assert ultimo is not None
    raise RuntimeError(f"falló la descarga de {url}: {ultimo}") from ultimo


def descargar_url(url: str) -> tuple[str, bytes]:
    """Descarga el cuerpo y devuelve (url_final, bytes)."""
    resp = _get_con_reintentos(url)
    return str(resp.url), resp.content


def upsert_entrada(
    entradas: list[dict[str, Any]],
    entrada: dict[str, Any],
) -> list[dict[str, Any]]:
    """Reemplaza o agrega una entrada por id, preservando el orden."""
    out: list[dict[str, Any]] = []
    visto = False
    for e in entradas:
        if e.get("id") == entrada["id"]:
            out.append(entrada)
            visto = True
        else:
            out.append(e)
    if not visto:
        out.append(entrada)
    return out


def descargar_fuentes(
    fuentes: list[Fuente],
    dir_raw: Path,
    ruta_manifiesto: Path,
    *,
    forzar: bool = False,
    desde_cache: bool = False,
) -> list[dict[str, Any]]:
    """Descarga (o reutiliza) cada fuente y actualiza el manifiesto."""
    dir_raw.mkdir(parents=True, exist_ok=True)
    entradas = leer_manifiesto(ruta_manifiesto)
    por_id = indice_manifiesto(entradas)

    for fuente in fuentes:
        path = ruta_crudo(dir_raw, fuente)
        previa = por_id.get(fuente.id)
        if desde_cache:
            if not path.exists():
                raise FileNotFoundError(
                    f"--desde-cache: falta {path} (fuente {fuente.id})"
                )
            if previa is None:
                entrada = {
                    "id": fuente.id,
                    "url": fuente.url,
                    "sha256": sha256_archivo(path),
                    "bytes": path.stat().st_size,
                    "fecha": datetime.now(UTC).isoformat(),
                }
                entradas = upsert_entrada(entradas, entrada)
                por_id[fuente.id] = entrada
            continue

        if not debe_descargar(path, previa, forzar=forzar):
            continue

        url_final, cuerpo = descargar_url(fuente.url)
        path.write_bytes(cuerpo)
        entrada = {
            "id": fuente.id,
            "url": url_final,
            "sha256": sha256_bytes(cuerpo),
            "bytes": len(cuerpo),
            "fecha": datetime.now(UTC).isoformat(),
        }
        entradas = upsert_entrada(entradas, entrada)
        por_id[fuente.id] = entrada

    escribir_manifiesto(ruta_manifiesto, entradas)
    return entradas
