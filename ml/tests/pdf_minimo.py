"""PDF 1.4 mínimo generado en memoria para tests (sin red)."""

from __future__ import annotations


def _esc(texto: str) -> str:
    return (
        texto.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def construir_pdf(paginas: list[str]) -> bytes:
    """Una página por cadena, Helvetica, texto extraíble por pypdf."""
    n = len(paginas)
    if n < 1:
        raise ValueError("hace falta al menos una página")
    bodies: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }
    kids: list[str] = []
    first_page = 4
    for i, texto in enumerate(paginas):
        page_id = first_page + 2 * i
        content_id = page_id + 1
        kids.append(f"{page_id} 0 R")
        stream = (
            f"BT /F1 12 Tf 72 720 Td ({_esc(texto)}) Tj ET"
        ).encode("latin-1", "replace")
        bodies[content_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode()
            + stream
            + b"\nendstream"
        )
        bodies[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode()
    bodies[2] = (
        f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {n} >>"
    ).encode()

    max_id = first_page + 2 * n - 1
    out = bytearray(b"%PDF-1.4\n")
    offsets = {0: 0}
    for i in range(1, max_id + 1):
        offsets[i] = len(out)
        out += f"{i} 0 obj\n".encode() + bodies[i] + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {max_id + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for i in range(1, max_id + 1):
        out += f"{offsets[i]:010d} 00000 n \n".encode()
    out += (
        f"trailer << /Size {max_id + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    ).encode()
    return bytes(out)
