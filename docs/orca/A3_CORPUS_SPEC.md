# Spec A3 — corpus-indexer (descarga, chunking y embeddings bge-m3)

Ola A3 de Relevo (semana 2). Lee antes: `docs/ARQUITECTURA.md` (§6 tablas
`documentos`/`chunks`, §7 estrategia del corpus), `docs/PLAN_DESARROLLO.md`,
`CLAUDE.md`.

## Objetivo

Pipeline de indexación del corpus normativo colombiano: descarga reproducible de
las fuentes públicas, chunking estructural (leyes por artículo), embeddings
bge-m3 y upsert en pgvector. En esta ola el pipeline queda **probado sin base de
datos** (la corrida completa contra la BD es de la ola B2).

## Archivos que PUEDES tocar (nada más)

- `ml/**` (`ml/indexar.py`, módulos auxiliares en `ml/corpus_lib/`,
  `ml/requirements.txt`, `ml/pyproject.toml` config ruff/pytest, `ml/tests/**`
  con fixtures)
- `corpus/fuentes.json`, `corpus/README.md`
- `docs/orca/reports/A3_CORPUS_REPORT.md`

PROHIBIDO tocar: `.gitignore` (ya ignora `corpus/raw/` y `corpus/cache/`),
`db/`, `data/`, `docker-compose.yml`, todo lo TS, `README.md`, `CLAUDE.md`,
`docs/*.md`.

## Requisitos

1. **`corpus/fuentes.json`**: lista de fuentes con `id`, `titulo`, `tipo`
   (`ley`/`cartilla`), `url`, `formato` (`html`/`pdf`), `vigencia` (nota
   textual). Puntos de partida (VERIFICA cada URL con una petición real y
   corrige/reemplaza las que no respondan; deja en el JSON las definitivas):
   - Código Sustantivo del Trabajo, texto consolidado: Secretaría del Senado
     (`secretariasenado.gov.co/senado/basedoc/codigo_sustantivo_trabajo.html`,
     está paginado en varias páginas `..._prN.html`: inclúyelas todas) o el
     gestor normativo de Función Pública como espejo.
   - Ley 2101 de 2021 (reducción de jornada) y Ley 2466 de 2025 (reforma
     laboral): Función Pública / SUIN-Juriscol.
   - 1–2 cartillas o guías del Ministerio del Trabajo sobre jornada laboral y
     trabajo suplementario (PDF). Si ninguna URL oficial responde, documenta el
     intento en el reporte y deja el corpus solo con las leyes.
2. **`ml/indexar.py`** (CLI con argparse, subcomandos o flags):
   - `--solo-descarga`: descarga cada fuente a `corpus/raw/<id>.<ext>` con
     reintentos, User-Agent normal, y escribe `corpus/raw/manifiesto.json`
     (id, url final, sha256, bytes, fecha). Idempotente: si el hash ya existe,
     no re-descarga (`--forzar` para invalidar).
   - Parseo: HTML con BeautifulSoup (extraer texto limpio conservando títulos
     de PARTE/TÍTULO/CAPÍTULO), PDF con pypdf.
   - **Chunking estructural**: leyes → un chunk por artículo (regex sobre
     `ARTICULO`/`ARTÍCULO`/`Artículo N.`), con `ref` = «art. N» y el
     encadenado capítulo/título como prefijo de contexto; artículos > 1200
     tokens se parten con solape de 100; cartillas PDF → secciones de 500–800
     tokens con solape de 100 y `ref` = «p. N».
   - Embeddings: `FlagEmbedding.BGEM3FlagModel("BAAI/bge-m3")`, solo densos,
     normalizados, por lotes de 16, en CPU; caché del modelo en el HF cache
     estándar.
   - Upsert: inserta en `documentos` y `chunks` (psycopg, `pgvector.psycopg`)
     según el esquema de ARQUITECTURA §6; borra los chunks previos del
     documento si el hash cambió. `DATABASE_URL` de entorno con el mismo
     default local que el resto del proyecto.
   - Flags: `--limit N` (solo N chunks, para pruebas), `--desde-cache` (no
     redescarga), `--sin-bd` (todo el pipeline hasta escribir
     `corpus/cache/chunks.jsonl` en vez de la BD).
3. **Tests** (`ml/tests/`, pytest, SIN base de datos y SIN red): fixtures
   pequeñas (un HTML recortado estilo Senado con 3 artículos y un PDF mínimo
   generado en el test) que prueban: el chunker separa los 3 artículos con
   `ref` correcta; los títulos de capítulo quedan como contexto; el particionado
   de artículos largos respeta el solape; el manifiesto calcula hash estable;
   `--sin-bd` produce JSONL válido con metadatos completos (con embeddings
   simulados vía monkeypatch — los tests no cargan bge-m3).
4. **Verificación real mínima** (para el reporte, no como test): corre
   `python ml/indexar.py --solo-descarga` y luego
   `python ml/indexar.py --desde-cache --sin-bd --limit 40` con el modelo real,
   y pega en el reporte el conteo de documentos descargados, chunks generados y
   una muestra de 2 chunks (ref + primeros 200 caracteres).
5. **Calidad**: `ml/requirements.txt` (FlagEmbedding, torch CPU, beautifulsoup4,
   lxml, pypdf, httpx, psycopg[binary], pgvector, pytest, ruff); ruff config en
   `ml/pyproject.toml`; código y docstrings en español; UTF-8 sin BOM; sin
   secretos.

## Gates (en ESTE worktree)

```
python -m venv .venv && .venv/Scripts/pip install -r ml/requirements.txt
.venv/Scripts/python -m ruff check ml
.venv/Scripts/python -m pytest ml/tests -v
```

más la verificación real del punto 4.

## Entrega

- Reporte `docs/orca/reports/A3_CORPUS_REPORT.md`: URLs definitivas y cuáles
  fallaron, decisiones de chunking, salida LITERAL de ruff/pytest y de la
  verificación real, hash del commit.
- Commit único: `feat(ml): pipeline de indexación del corpus normativo (A3)`
  — recuerda que `corpus/raw/` y `corpus/cache/` NO se comitean.
- Sin push, sin merge, sin PR.
