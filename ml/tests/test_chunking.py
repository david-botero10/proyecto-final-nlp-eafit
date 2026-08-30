"""Chunker estructural: artículos, contexto de capítulo y solape."""

from __future__ import annotations

from pathlib import Path

from html_senado import HTML_TRES_ARTICULOS
from pdf_minimo import construir_pdf

from corpus_lib.chunking import chunkear_cartilla, chunkear_ley
from corpus_lib.parseo import extraer_paginas_pdf, extraer_texto_html
from corpus_lib.tokens import contar_tokens


def test_chunker_separa_tres_articulos_con_ref():
    texto = extraer_texto_html(HTML_TRES_ARTICULOS)
    chunks = chunkear_ley(texto, fuente_id="cst_recorte")
    assert [c.ref for c in chunks] == ["art. 22", "art. 23", "art. 29"]
    assert all(c.fuente_id == "cst_recorte" for c in chunks)
    assert "Contrato de trabajo" in chunks[0].texto
    assert "elementos esenciales" in chunks[1].texto
    assert "dieciocho" in chunks[2].texto


def test_titulos_de_capitulo_quedan_como_contexto():
    texto = extraer_texto_html(HTML_TRES_ARTICULOS)
    chunks = chunkear_ley(texto)
    por_ref = {c.ref: c for c in chunks}
    assert "TITULO I. CONTRATO INDIVIDUAL DE TRABAJO" in por_ref["art. 22"].texto
    assert "CAPITULO I. DEFINICIONES" in por_ref["art. 22"].texto
    assert "CAPITULO I. DEFINICIONES" in por_ref["art. 23"].texto
    assert "CAPITULO II. CAPACIDAD PARA CONTRATAR" in por_ref["art. 29"].texto
    assert "CAPITULO I. DEFINICIONES" not in por_ref["art. 29"].texto
    assert por_ref["art. 22"].metadatos["capitulo"].startswith("CAPITULO I")
    assert por_ref["art. 29"].metadatos["capitulo"].startswith("CAPITULO II")
    assert por_ref["art. 23"].metadatos["titulo"].startswith("TITULO I")


def test_particionado_articulo_largo_respeta_solape():
    palabras = [f"w{i:04d}" for i in range(1300)]
    texto = "CAPITULO I. LARGO\nARTICULO 99. " + " ".join(palabras)
    chunks = chunkear_ley(texto)
    assert len(chunks) >= 2
    assert chunks[0].ref == "art. 99"
    assert chunks[1].ref == "art. 99 (2)"
    t0 = chunks[0].texto.split()
    t1 = chunks[1].texto.split()
    assert len(t0) == 1200
    assert t0[-100:] == t1[:100]
    assert contar_tokens(chunks[0].texto) == 1200


def test_pdf_minimo_extrae_texto_y_ref_pagina(tmp_path: Path):
    pdf = construir_pdf(["Jornada laboral maxima legal", "Trabajo suplementario"])
    ruta = tmp_path / "cartilla.pdf"
    ruta.write_bytes(pdf)
    paginas = extraer_paginas_pdf(ruta)
    assert len(paginas) == 2
    assert paginas[0][0] == 1
    plano = " ".join(t for _, t in paginas)
    assert "Jornada" in plano or "jornada" in plano.lower()
    chunks = chunkear_cartilla(paginas, fuente_id="cartilla_min")
    assert chunks
    assert chunks[0].ref.startswith("p. ")


def test_cartilla_ventanas_con_solape_y_ref_de_pagina():
    paginas = [
        (i, " ".join(f"p{i}t{j}" for j in range(50))) for i in range(1, 21)
    ]
    chunks = chunkear_cartilla(paginas)
    assert len(chunks) == 2
    assert chunks[0].ref == "p. 1"
    assert chunks[0].metadatos["tokens"] == 800
    t0 = chunks[0].texto.split()
    t1 = chunks[1].texto.split()
    assert t0[-100:] == t1[:100]
    assert chunks[1].ref == "p. 15"

def test_html_utf8_con_bom_sin_charset_no_produce_mojibake():
    """Regresión: Función Pública sirve UTF-8 con BOM y sin charset declarado."""
    html = (
        "<html><body><p>ARTÍCULO 1°. Objeto de la ley.</p>"
        "<p>El artículo regula la jornada laboral.</p>"
        "<p>Artículo 2°. Vigencia y derogatorias.</p></body></html>"
    ).encode("utf-8-sig")
    texto = extraer_texto_html(html)
    assert "ARTÍCULO 1°" in texto
    assert "Ã" not in texto
    chunks = chunkear_ley(texto, fuente_id="ley_prueba")
    assert [c.ref for c in chunks] == ["art. 1", "art. 2"]
