# Reporte A3 — corpus-indexer

Worktree `a3-corpus`, rama `david-botero10/a3-corpus`, base `6aa99d8`.
Python del venv: **3.11.16** (`pyproject.toml` pide `>=3.11`; `python` en
PATH es 3.10.11). El venv se creó con
`C:\Users\davbo\AppData\Roaming\uv\python\cpython-3.11.16-windows-x86_64-none\python.exe`.

## URLs definitivas

Verificadas con GET real (200) y dejadas en `corpus/fuentes.json`:

| id | tipo | formato | URL | bytes (manifiesto) |
|---|---|---|---|---|
| `cst` … `cst_pr017` (18 págs.) | ley | html | `http://www.secretariasenado.gov.co/senado/basedoc/codigo_sustantivo_trabajo.html` y `_pr001` … `_pr017` | 72 166 … 46 201 |
| `ley_2101_2021` | ley | html | `https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=166506` | (manifiesto) |
| `ley_2466_2025` | ley | html | `https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676` | (manifiesto) |

**CST:** 18 páginas (`pr018` → 404). HTTPS de `secretariasenado.gov.co` no
conecta; se usa HTTP. Espejo Función Pública
`norma.php?i=199983` también 200 (485 kB) pero no se indexó para no duplicar.

**Leyes 2101 y 2466:** Gestor normativo de Función Pública, HTML con
`ARTÍCULO` en el cuerpo. PDFs `norma_pdf.php` también 200; se prefirió HTML
para el chunker por artículo.

Manifiesto: **20 documentos**, 1 743 846 bytes crudos. `corpus/raw/` no se
comitea.

## URLs que fallaron (cartillas MinTrabajo)

La spec pide 1–2 cartillas PDF de jornada / trabajo suplementario. Intentos
(GET, User-Agent de indexador):

| URL | Resultado |
|---|---|
| `https://www.mintrabajo.gov.co/documents/20147/0/Cartilla+Jornada+Laboral.pdf` | falla (sin código HTTP usable) |
| `https://www.mintrabajo.gov.co/documents/20147/59904/cartilla_jornada_laboral.pdf` | falla |
| `https://www.mintrabajo.gov.co/documents/20147/59995831/CARTILLA+JORNADA+LABORAL.pdf` | falla |
| `https://www.mintrabajo.gov.co/documents/20147/0/ABC+JORNADA+LABORAL.pdf` | falla |
| `https://www.mintrabajo.gov.co/documents/20147/0/jornada+laboral.pdf` | falla |
| `https://www.mintrabajo.gov.co/documents/20147/0/trabajo+suplementario.pdf` | falla |
| `https://www.mintrabajo.gov.co/documents/20147/0/Cartilla+trabajo+suplementario.pdf` | falla |
| `https://www.mintrabajo.gov.co/` | 200, HTML del portal (no PDF) |
| `https://www.suin-juriscol.gov.co/` | falla |

El corpus de esta ola queda **solo con las leyes**. El chunker de cartillas
(ventanas 800 / solape 100, `ref = p. N`) está cubierto con un PDF mínimo
generado en `ml/tests`.

## Decisiones de chunking

- Token = palabra separada por espacio (determinista, sin cargar bge-m3 en tests).
- Leyes: un chunk por artículo (`ARTICULO` / `ARTÍCULO` / `Artículo N.`);
  `ref = art. N`. PARTE / TÍTULO / CAPÍTULO con punto (`CAPITULO I.`) se
  anteponen como contexto. Se ignoran anclas de índice del Senado
  (`CAPITULO XIII-9-1`).
- Artículos > 1200 tokens: ventanas de 1200 con solape 100; `art. N (2)`, …
- Cartillas: 800 tokens, solape 100, `ref = p. N` de la página del primer token.
- HTML: BeautifulSoup + lxml; se recortan script/nav y líneas de chrome
  («Notas de vigencia», etc.).
- PDF: pypdf.
- Embeddings: `FlagEmbedding.BGEM3FlagModel("BAAI/bge-m3")`, densos,
  L2-normalizados, lote 16, CPU, caché HF estándar.
- Descarga: httpx, 3 reintentos, User-Agent `RelevoCorpusIndexer/1.0`.
  En Windows `verify` usa el almacén de certificados del sistema: certifi
  solo no valida `funcionpublica.gov.co` (`CERTIFICATE_VERIFY_FAILED`).
- Upsert (ola B2): `DATABASE_URL` default
  `postgresql://relevo:relevo@localhost:5432/relevo`; borra chunks si el
  hash del documento cambió. Esta ola corre `--sin-bd`.

## Gate 1 — venv + pip

```
python -m venv .venv && .venv/Scripts/pip install -r ml/requirements.txt
```

(equivalente con Python 3.11.16; pip 26.2.1)

Última línea:

```
Successfully installed FlagEmbedding-1.4.2 … torch-2.13.0 … transformers-5.16.1 …
```

## Gate 2 — ruff (literal)

```
.venv/Scripts/python -m ruff check ml
```

```
All checks passed!
```

## Gate 3 — pytest (literal)

```
.venv/Scripts/python -m pytest ml/tests -v
```

```
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a3-corpus\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a3-corpus\ml
configfile: pyproject.toml
plugins: anyio-4.14.2
collecting ... collected 11 items

ml\tests\test_chunking.py::test_chunker_separa_tres_articulos_con_ref PASSED [  9%]
ml\tests\test_chunking.py::test_titulos_de_capitulo_quedan_como_contexto PASSED [ 18%]
ml\tests\test_chunking.py::test_particionado_articulo_largo_respeta_solape PASSED [ 27%]
ml\tests\test_chunking.py::test_pdf_minimo_extrae_texto_y_ref_pagina PASSED [ 36%]
ml\tests\test_chunking.py::test_cartilla_ventanas_con_solape_y_ref_de_pagina PASSED [ 45%]
ml\tests\test_manifiesto.py::test_hash_sha256_es_estable_y_de_64_hex PASSED [ 54%]
ml\tests\test_manifiesto.py::test_hash_archivo_coincide_con_bytes PASSED [ 63%]
ml\tests\test_manifiesto.py::test_no_redescarga_si_el_hash_ya_existe PASSED [ 72%]
ml\tests\test_manifiesto.py::test_fuente_dataclass_minima PASSED         [ 81%]
ml\tests\test_sin_bd.py::test_sin_bd_jsonl_metadatos_completos PASSED    [ 90%]
ml\tests\test_sin_bd.py::test_limit_recorta_chunks PASSED                [100%]

============================= 11 passed in 0.78s ==============================
```

Sin base de datos y sin red.

## Verificación real (punto 4 de la spec)

### `python ml/indexar.py --solo-descarga`

```
{
  "documentos": 20,
  "descargados": 20,
  "chunks": 0,
  "jsonl": null,
  "insertados_bd": 0
}
```

### `python ml/indexar.py --desde-cache --sin-bd --limit 40`

Modelo real `BAAI/bge-m3` (caché HF). Salida final:

```
{
  "documentos": 20,
  "descargados": 20,
  "chunks": 40,
  "jsonl": "C:\\Users\\davbo\\orca\\workspaces\\Proyecto Final NLP 2026\\a3-corpus\\corpus\\cache\\chunks.jsonl",
  "insertados_bd": 0
}
```

Conteos: **20 documentos** descargados, **40 chunks** (límite) con embedding
de 1024 d. `corpus/cache/` no se comitea.

### Muestra de 2 chunks (ref + primeros 200 caracteres)

**1.** `ref = art. 1` (fuente `cst`)

```
TITULO PRELIMINAR. ARTICULO 1o. OBJETO. La finalidad primordial de este Código es la de lograr la justicia en las relaciones que surgen entre {empleadores} y trabajadores, dentro de un espíritu de coo
```

**2.** `ref = art. 2` (fuente `cst`)

```
TITULO PRELIMINAR. ARTICULO 2o. APLICACION TERRITORIAL. El presente Código rige en todo el territorio de la República para todos sus habitantes, sin consideración a su nacionalidad.
```

(`{empleadores}` es marcado del HTML del Senado; se conserva.)

## Hash del commit

`git rev-parse HEAD` en este worktree (rama `david-botero10/a3-corpus`).
Valor al cerrar el reporte: `ac37a43f6a70a401b03332a2889b479004925865`.
Si un amend posterior del propio reporte cambia el SHA, prevalece `git rev-parse HEAD`.
