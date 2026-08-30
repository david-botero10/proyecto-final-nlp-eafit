# Spec A2 — db-schema (PostgreSQL + pgvector, migraciones y dataset sintético)

Ola A2 de Relevo (semana 2). Lee antes: `docs/ARQUITECTURA.md` (§6 esquema, §4.1
contratos, §7 corpus), `docs/PLAN_DESARROLLO.md`, `CLAUDE.md`.

## Objetivo

Base de datos local reproducible: Docker Compose con pgvector, migraciones SQL
del esquema completo de la arquitectura, roles de lectura/escritura, y el
dataset sintético colombiano generado y sembrado de forma determinista.

## Archivos que PUEDES tocar (nada más)

- `docker-compose.yml`
- `db/**` (`db/migrations/*.sql`, `db/migrate.py`, `db/seed.py`,
  `db/requirements.txt`, `db/pyproject.toml` solo-config de ruff/pytest,
  `db/tests/**`, `db/seed/*.sql` generados)
- `data/**` (`data/generar_dataset.py`)
- `docs/orca/reports/A2_DB_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `package.json` y todo lo TS (`app/`, `lib/`,
`components/`), `ml/`, `corpus/`, `mcp/`, `README.md`, `CLAUDE.md`, `docs/*.md`.

## Requisitos

1. **`docker-compose.yml`**: servicio `db`, imagen `pgvector/pgvector:pg17`,
   puerto `${PGPORT:-5432}:5432`, volumen nombrado, healthcheck `pg_isready`.
   Credenciales vía variables con defaults de desarrollo (`relevo`/`relevo`,
   BD `relevo`) — son locales y sintéticas, no secretos.
2. **Migraciones** (`db/migrations/NNNN_nombre.sql`, orden numérico):
   - `0001_extensiones.sql`: `CREATE EXTENSION vector; CREATE EXTENSION unaccent;`
     y la función inmutable para el tsvector generado:
     `CREATE FUNCTION es_unaccent(text) RETURNS text AS $$ SELECT public.unaccent('public.unaccent', $1) $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;`
   - `0002_nomina.sql`: `turnos`, `empleados`, `asignaciones`, `ausencias`
     exactamente como §6 de ARQUITECTURA (tipos, CHECKs, UNIQUEs, FKs, índices
     por `empleado_id, fecha`).
   - `0003_gobernanza.sql`: `propuestas`, `aprobaciones`, `pares_preferencia`,
     `perfiles`, `conversaciones`, `mensajes`.
   - `0004_corpus.sql`: `documentos`, `chunks` con `embedding vector(1024)`,
     `tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', es_unaccent(texto))) STORED`,
     índice HNSW (`vector_cosine_ops`) y GIN sobre `tsv`.
   - `0005_roles.sql`: roles `relevo_lector` (SELECT en todo) y
     `relevo_escritor` (además INSERT/UPDATE en las tablas que escribe el
     sistema), con `GRANT` explícitos y comentario de para qué sirve cada uno.
   - Comentarios `COMMENT ON TABLE/COLUMN` en español para las tablas centrales.
3. **`db/migrate.py`** (psycopg 3): aplica migraciones pendientes en orden con
   tabla `schema_migrations(nombre, aplicado_en)`; idempotente; toma
   `DATABASE_URL` de entorno con default local
   `postgresql://relevo:relevo@localhost:5432/relevo`; `--reset` opcional que
   dropea el esquema público y reaplica (solo local).
4. **`data/generar_dataset.py`** (Faker `es_CO`, `SEED = 42`, determinista):
   genera `db/seed/01_turnos.sql` … `04_ausencias.sql` con INSERTs:
   - 3 turnos: M (06:00–14:00), T (14:00–22:00), N (22:00–06:00,
     `cruza_medianoche`).
   - 40 empleados, equipos `enfermeria` (20), `recepcion` (10), `vigilancia`
     (10), roles coherentes, documentos y nombres sintéticos.
   - 8 semanas de asignaciones desde el lunes 2026-08-03: rotación semanal
     M→T→N por subgrupos, máx. 6 días/semana por empleado, domingos alternados.
   - ~30 ausencias (vacaciones, incapacidad, permiso, licencia) sin solapes
     con asignaciones: el generador cancela o omite asignaciones en conflicto.
   - Validaciones internas al final (asserts): sin solapes, límites semanales,
     FKs consistentes. Si una validación falla, el script termina con error.
5. **`db/seed.py`**: aplica los `db/seed/*.sql` en orden dentro de una
   transacción; `--reseed` trunca las tablas de nómina antes.
6. **Tests** (`db/tests/`, pytest): contra la BD del compose (usa
   `DATABASE_URL`; el test hace `pytest.skip` claro si no hay conexión, y el
   reporte debe mostrar la corrida CON base activa): migraciones aplican de
   cero; re-aplicar es no-op; el seed deja los conteos esperados; el UNIQUE de
   asignaciones rechaza duplicados; una consulta de solapes devuelve 0 filas;
   los roles existen y `relevo_lector` no puede insertar.
7. **Calidad Python**: `db/requirements.txt` (psycopg[binary], Faker, pytest,
   ruff); config ruff en `db/pyproject.toml`; código y docstrings en español;
   UTF-8 sin BOM; ningún secreto (las credenciales default de desarrollo van en
   código como constantes documentadas).

## Gates (en ESTE worktree)

```
docker compose up -d db
python -m venv .venv && .venv/Scripts/pip install -r db/requirements.txt
.venv/Scripts/python db/migrate.py && .venv/Scripts/python data/generar_dataset.py && .venv/Scripts/python db/seed.py
.venv/Scripts/python -m ruff check db data
.venv/Scripts/python -m pytest db/tests -v
```

(`npm run lint/test/build` aún no integran Python — eso llega en B2; tus gates
son ruff + pytest + la corrida completa de migrar/generar/sembrar.)

## Entrega

- Reporte `docs/orca/reports/A2_DB_REPORT.md`: decisiones, salida LITERAL de los
  gates (incluida la corrida de migrate/generar/seed y los conteos finales por
  tabla), hash del commit.
- Commit único: `feat(db): esquema pgvector, migraciones y dataset sintético (A2)`
- Sin push, sin merge, sin PR. Apaga el contenedor al terminar
  (`docker compose down`).
