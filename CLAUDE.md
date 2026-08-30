# Relevo — guía para agentes

Proyecto final de SI7016 Procesamiento del Lenguaje Natural Aplicado (Universidad
EAFIT, Maestría en Ciencias de Datos y Analítica, 2026-2). Equipo: Isabel Jurado,
Alejandro Silva, David Botero.

**Relevo** es un agente conversacional de gestión de turnos y ausencias para pymes
colombianas. Principio de diseño: **consultar es autónomo; escribir exige
aprobación humana en una tarjeta estructurada**.

Lee `docs/ARQUITECTURA.md` y `docs/PLAN_DESARROLLO.md` antes de tocar código.

## Reglas duras (no negociables)

1. **Datos sintéticos**: todos los datos de empleados/turnos/ausencias son
   ficticios y generados por nosotros. Nada de datos reales ni de terceros.
2. **Escritura solo con aprobación**: ninguna ruta de código escribe en tablas de
   nómina (`empleados`, `asignaciones`, `ausencias`) sin una propuesta aprobada
   por un humano. La tarjeta es el permiso: lo que muestra es exactamente lo que
   se escribe.
3. **Secretos solo en `.env`** (nunca en el repo, logs, tests ni reportes).
   `.env.example` documenta las variables sin valores reales.
4. **UTF-8 sin BOM** en todos los archivos de texto.
5. **Español** en la UI, la documentación y los mensajes de commit.
6. No copies código, prompts, datos ni documentos de otros proyectos (p. ej.
   laborales). Este repo es original del equipo.
7. Workers en worktrees: tocar SOLO los archivos listados en la spec de la ola;
   no tocar `.gitignore`; no comitear `.atl/` ni `node_modules/`; no push, no
   merge (eso lo hace el orquestador tras auditoría).

## Comandos (gates)

- `npm run lint` — ESLint (TS) + ruff (Python, cuando exista).
- `npm test` — Vitest (TS) + pytest (Python, cuando exista).
- `npm run build` — build de Next.js.
- Base de datos local: `docker compose up -d db` (PostgreSQL + pgvector en 5432).

Los tres gates deben quedar verdes antes de cualquier merge a `main`.

## Estructura

- `app/`, `components/`, `lib/` — chat web Next.js 15 + Vercel AI SDK (TypeScript).
- `mcp/` — servidor MCP con las tools (ola B).
- `db/` — migraciones SQL, seed y runner (Python/psycopg).
- `data/` — generador del dataset sintético.
- `ml/` — indexación del corpus (bge-m3), luego LoRA/DPO (Python).
- `corpus/` — fuentes normativas (`raw/` no se versiona).
- `docs/` — arquitectura, plan, fuentes del curso, specs de olas (`docs/orca/`).

## Convenciones

- Identificadores de dominio en español (`empleados`, `asignaciones`, `propuestas`).
- SQL explícito (postgres-js en TS, psycopg en Python); sin ORM.
- Embeddings: bge-m3, 1024 dimensiones, columna `vector(1024)`.
- Búsqueda léxica: `tsvector` con configuración `spanish` + unaccent.
