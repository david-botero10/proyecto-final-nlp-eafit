"""Hash estable del manifiesto e idempotencia de descarga."""

from __future__ import annotations

from pathlib import Path

from corpus_lib.descarga import debe_descargar, sha256_archivo, sha256_bytes
from corpus_lib.modelos import Fuente


def test_hash_sha256_es_estable_y_de_64_hex():
    a = sha256_bytes(b"corpus-relevo")
    b = sha256_bytes(b"corpus-relevo")
    c = sha256_bytes(b"corpus-relevo!")
    assert a == b
    assert a != c
    assert len(a) == 64
    assert int(a, 16) >= 0


def test_hash_archivo_coincide_con_bytes(tmp_path: Path):
    ruta = tmp_path / "doc.html"
    cuerpo = b"<html><p>ARTICULO 1o. OBJETO.</p></html>"
    ruta.write_bytes(cuerpo)
    assert sha256_archivo(ruta) == sha256_bytes(cuerpo)


def test_no_redescarga_si_el_hash_ya_existe(tmp_path: Path):
    ruta = tmp_path / "cst.html"
    cuerpo = b"<html>ok</html>"
    ruta.write_bytes(cuerpo)
    previa = {
        "id": "cst",
        "url": "http://ejemplo.test/cst.html",
        "sha256": sha256_bytes(cuerpo),
        "bytes": len(cuerpo),
        "fecha": "2026-08-30T00:00:00+00:00",
    }
    assert debe_descargar(ruta, previa, forzar=False) is False
    assert debe_descargar(ruta, previa, forzar=True) is True
    ruta.write_bytes(b"<html>cambio</html>")
    assert debe_descargar(ruta, previa, forzar=False) is True
    assert debe_descargar(ruta, None, forzar=False) is True


def test_fuente_dataclass_minima():
    f = Fuente(
        id="cst",
        titulo="CST",
        tipo="ley",
        url="http://ejemplo.test",
        formato="html",
        vigencia="consolidado",
    )
    assert f.id == "cst"
