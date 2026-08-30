# Reporte A2 — db-schema

Worktree: `david-botero10/a2-db` (hijo de main `6aa99d8`).
Fecha: 2026-08-30.

## Decisiones

- `propuesta_id` en `asignaciones` y `ausencias` se declara en `0002_nomina.sql`
  (UUID nulo) y la FK a `propuestas` se añade en `0003_gobernanza.sql`, para
  romper el ciclo con gobernanza.
- Roles `relevo_lector` y `relevo_escritor` son `NOLOGIN` (no hay contraseñas
  en SQL). El usuario de desarrollo `relevo` recibe ambos roles para las
  pruebas (`SET ROLE`). `0005_roles.sql` es idempotente: los roles viven en el
  clúster y sobreviven a `--reset`.
- `--reset` de `db/migrate.py` solo corre si `DATABASE_URL` apunta a localhost.
- El generador **omite** asignaciones que caen en una ausencia `aprobada`
  (no las deja `cancelada`). Validaciones internas: un turno por empleado y
  fecha, máximo 6 días por semana, FKs consistentes.
- Rotación: cada equipo se parte en 3 subgrupos; semana `w` usa turno
  `(subgrupo + w) % 3` (M→T→N). Domingos alternados por empleado; si trabaja
  domingo, libera el sábado.
- Credenciales `relevo`/`relevo` y BD `relevo` son defaults locales de
  desarrollo (sintéticos, no secretos). `DATABASE_URL` no se imprime completa.
- Dataset: Faker `es_CO`, `SEED = 42`. Conteos finales: **turnos=3,
  empleados=40, asignaciones=1837, ausencias=30**.

## Gates (salida literal)

### 1. `docker compose up -d db`

```
Image pgvector/pgvector:pg17 Pulled
Network a2-db_default Creating
Network a2-db_default Created
Volume a2-db_relevo_pgdata Creating
Volume a2-db_relevo_pgdata Created
Container a2-db-db-1 Creating
Container a2-db-db-1 Created
Container a2-db-db-1 Starting
Container a2-db-db-1 Started
```

Healthcheck posterior:

```
NAME         IMAGE                    COMMAND                  SERVICE   CREATED          STATUS                    PORTS
a2-db-db-1   pgvector/pgvector:pg17   "docker-entrypoint.s…"   db        29 seconds ago   Up 26 seconds (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
/var/run/postgresql:5432 - accepting connections
```

### 2. `python -m venv .venv && .venv/Scripts/pip install -r db/requirements.txt`

```
Successfully installed Faker-40.37.0 colorama-0.4.6 exceptiongroup-1.3.1 iniconfig-2.3.0 packaging-26.3 pluggy-1.6.0 psycopg-3.3.4 psycopg-binary-3.3.4 pygments-2.21.0 pytest-9.1.1 ruff-0.16.5 tomli-2.4.1 typing-extensions-4.16.0 tzdata-2026.3
```

(Python 3.10.11 del worktree; ruff y pytest en el venv.)

### 3. `migrate` + `generar_dataset` + `seed`

```
aplicada 0001_extensiones.sql
aplicada 0002_nomina.sql
aplicada 0003_gobernanza.sql
aplicada 0004_corpus.sql
aplicada 0005_roles.sql
escrito C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a2-db\db\seed\01_turnos.sql
escrito C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a2-db\db\seed\02_empleados.sql
escrito C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a2-db\db\seed\03_asignaciones.sql
escrito C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a2-db\db\seed\04_ausencias.sql
conteos: turnos=3 empleados=40 asignaciones=1837 ausencias=30
sembrado 01_turnos.sql
sembrado 02_empleados.sql
sembrado 03_asignaciones.sql
sembrado 04_ausencias.sql
conteos: turnos=3 empleados=40 asignaciones=1837 ausencias=30
```

### 4. `.venv/Scripts/python -m ruff check db data`

```
All checks passed!
```

### 5. `.venv/Scripts/python -m pytest db/tests -v`

```
============================= test session starts =============================
platform win32 -- Python 3.10.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a2-db\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\a2-db\db
configfile: pyproject.toml
plugins: Faker-40.37.0
collecting ... collected 6 items

db\tests\test_esquema.py::test_migraciones_aplican_de_cero PASSED        [ 16%]
db\tests\test_esquema.py::test_reaplicar_es_noop PASSED                  [ 33%]
db\tests\test_esquema.py::test_seed_conteos PASSED                       [ 50%]
db\tests\test_esquema.py::test_unique_asignaciones_rechaza_duplicados PASSED [ 66%]
db\tests\test_esquema.py::test_consulta_solapes_devuelve_cero PASSED     [ 83%]
db\tests\test_esquema.py::test_roles_lector_no_puede_insertar PASSED     [100%]

============================== 6 passed in 2.79s ==============================
```

Suite corrida **con base activa** (no hubo `pytest.skip`).

## Conteos finales por tabla (nómina)

| Tabla         | Filas |
|---------------|------:|
| turnos        |     3 |
| empleados     |    40 |
| asignaciones  |  1837 |
| ausencias     |    30 |

Equipos: `enfermeria=20`, `recepcion=10`, `vigilancia=10`. Turno N con
`cruza_medianoche`. Solapes asignación↔ausencia aprobada: 0.

## Archivos tocados (solo los de la spec)

- `docker-compose.yml`
- `db/migrations/0001_extensiones.sql` … `0005_roles.sql`
- `db/migrate.py`, `db/seed.py`, `db/requirements.txt`, `db/pyproject.toml`
- `db/tests/conftest.py`, `db/tests/test_esquema.py`
- `db/seed/01_turnos.sql` … `04_ausencias.sql` (generados)
- `data/generar_dataset.py`
- `docs/orca/reports/A2_DB_REPORT.md`

## Commit

Mensaje: `feat(db): esquema pgvector, migraciones y dataset sintético (A2)`

Hash: `52ec627843352ecb8c7f0d32400109825ddeec40`
