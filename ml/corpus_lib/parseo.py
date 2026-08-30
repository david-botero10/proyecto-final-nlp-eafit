"""Parseo de HTML (BeautifulSoup) y PDF (pypdf) a texto limpio."""

from __future__ import annotations

import re
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader

_RUIDO = re.compile(
    r"^(notas de vigencia|resumen de notas|jurisprudencia|"
    r"concordancia|ir al inicio|siguiente|anterior|"
    r"imprimir|compartir)\b",
    re.IGNORECASE,
)


def extraer_texto_html(html: bytes | str) -> str:
    """Extrae texto conservando saltos entre bloques y títulos.

    BeautifulSoup decodifica entidades. Se eliminan script/style/nav y
    líneas de chrome típicas del Senado / Gestor normativo.
    """
    soup = BeautifulSoup(html, "lxml")
    for etiqueta in soup(["script", "style", "nav", "noscript", "iframe"]):
        etiqueta.decompose()
    crudo = soup.get_text("\n")
    lineas: list[str] = []
    for ln in crudo.splitlines():
        s = " ".join(ln.split())
        if not s or _RUIDO.match(s):
            continue
        lineas.append(s)
    texto = "\n".join(lineas)
    return re.sub(r"\n{3,}", "\n\n", texto).strip()


def extraer_paginas_pdf(ruta: Path) -> list[tuple[int, str]]:
    """Devuelve [(numero_pagina, texto), ...] a partir de 1."""
    lector = PdfReader(str(ruta))
    paginas: list[tuple[int, str]] = []
    for i, pagina in enumerate(lector.pages, start=1):
        texto = pagina.extract_text() or ""
        paginas.append((i, texto))
    return paginas
