# Relevo

Agente conversacional para coordinadores de turnos de pymes colombianas con
horarios rotativos (clínicas, restaurantes, vigilancia). Entiende español
coloquial («ponle el de la mañana a Ana toda la otra semana»), consulta la norma
laboral colombiana con citas, propone cada cambio en una tarjeta estructurada y
**solo escribe cuando una persona aprueba**. Cada decisión humana se captura como
dato de preferencia para afinar incrementalmente (DPO/LoRA) un extractor propio.

Proyecto final de **SI7016 — Procesamiento del Lenguaje Natural Aplicado**
(Universidad EAFIT, Maestría en Ciencias de Datos y Analítica, 2026-2).

**Equipo:** Isabel Jurado Jaramillo · Alejandro Silva Zuluaga · David Botero Londoño

## Arquitectura (un párrafo)

El chat (Next.js 15 + Vercel AI SDK) habla con un asistente que usa tools MCP de
**solo lectura** sobre PostgreSQL + pgvector; las escrituras de nómina no las
invoca el LLM: el backend ejecuta una propuesta **después** de que un humano
aprueba la tarjeta. El corpus normativo se indexa con bge-m3; el auditor A2A y
el ciclo DPO llegan en semanas posteriores. Detalle y diagramas:
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Entregable de la semana 2:
[`docs/entrega/S2_arquitectura.html`](docs/entrega/S2_arquitectura.html).

## Cómo correrlo de cero

**Requisitos:** Node 24, Python 3.10+ (el venv de `npm test` / `pytest ml` necesita **3.11**, porque `ml/` importa `datetime.UTC`), Docker.

1. Clona el repositorio y entra en la carpeta.
2. Levanta PostgreSQL + pgvector:
   `docker compose up -d db`
3. Crea el venv de gates y herramientas de datos (Python **3.11**):
   `python -m venv .venv`
   Si `python` es 3.10: `py -3.11 -m venv .venv`.
   - Windows: `.venv\Scripts\activate`
   - macOS/Linux: `source .venv/bin/activate`
4. Instala dependencias Python ligeras:
   `pip install -r requirements-dev.txt`
5. Aplica migraciones:
   `python db/migrate.py`
6. Genera el dataset sintético (Faker `es_CO`, semilla 42):
   `python data/generar_dataset.py`
7. Siembra la nómina:
   `python db/seed.py`
   (si las tablas ya tienen filas, usa `python db/seed.py --reseed`; no toca el corpus)
8. Instala dependencias Node:
   `npm ci`
9. Chat web (stream simulado en S2; Grok llega en S3):
   `npm run dev`
10. Servidor MCP de lectura (stdio):
    `npm run mcp`
11. Indexación del corpus (venv **aparte y fuera del clone**, para que ESLint y
    `next build` no recorran torch). Python 3.11 si está disponible (`ml/` lo
    pide). Desde la raíz del repo:

    ```text
    python -m venv ../relevo-ml-venv
    ..\relevo-ml-venv\Scripts\pip install -r ml/requirements.txt
    ..\relevo-ml-venv\Scripts\python ml/indexar.py --solo-descarga
    ..\relevo-ml-venv\Scripts\python ml/indexar.py --desde-cache
    ```

    En macOS/Linux: `../relevo-ml-venv/bin/pip` y `../relevo-ml-venv/bin/python`.
    `--desde-cache` **sin** `--limit`: un límite grabaría hashes con chunks
    parciales. Si `corpus/raw/` ya existe, puedes omitir `--solo-descarga`.
    No subas `.venv`, `../relevo-ml-venv` ni `node_modules`.

Opcional: copia [`.env.example`](.env.example) a `.env`. Sin `.env`, migrate,
seed, MCP y el chat usan el DSN local `postgresql://relevo:relevo@localhost:5432/relevo`.

Si el puerto 5432 ya está ocupado, publica otro con `PGPORT` y apunta
`DATABASE_URL` al mismo puerto. No apagues una base que otro compañero esté
usando.

## Gates

Con la base del compose activa y el venv de `requirements-dev.txt`:

```text
npm run lint    # ESLint + ruff check db data ml
npm test        # vitest + pytest db/tests + pytest ml/tests
npm run build   # next build
```

Si un gate mixto falla, el script `scripts/gates.mjs` indica la parte y el
comando para reproducirla.

## Estructura

| Ruta | Qué hay |
|---|---|
| `app/`, `components/`, `lib/` | Chat Next.js 15 + AI SDK |
| `mcp/` | Servidor MCP (tools de lectura) |
| `db/` | Migraciones SQL, runner y seed |
| `data/` | Generador del dataset sintético |
| `ml/` | Indexación bge-m3 (luego LoRA/DPO) |
| `corpus/` | `fuentes.json` (`raw/` no se versiona) |
| `docs/` | Arquitectura, plan, specs de olas |
| `docker-compose.yml` | PostgreSQL + pgvector local |

## Estado por semana

| Semana | Qué |
|---|---|
| **S2** (esta) | Arquitectura, esqueleto web, esquema + seed, corpus, MCP de lectura, gates unificados |
| **S3** | Chat con Grok, RAG híbrido, tarjeta de escritura, LoRA v1 |
| **S4** | Auditor A2A, ciclo DPO, observabilidad Phoenix |
| **S5** | Evaluación, informe y demo (tope 30 de septiembre de 2026) |

Plan detallado: [`docs/PLAN_DESARROLLO.md`](docs/PLAN_DESARROLLO.md).

## Reglas duras

1. **Datos sintéticos.** Empleados, turnos y ausencias son ficticios (Faker
   `es_CO`). Nada de datos reales ni de terceros.
2. **Escribir exige aprobación.** Ninguna ruta escribe en `empleados`,
   `asignaciones` o `ausencias` sin una propuesta aprobada en una tarjeta. Lo
   que muestra la tarjeta es exactamente lo que se escribe.
3. **Secretos solo en `.env`.** Nunca en el repo, logs, tests ni reportes.
   `.env.example` documenta las variables sin valores reales.
