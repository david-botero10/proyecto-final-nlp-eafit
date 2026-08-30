# Spec B1 — mcp-server (tools de lectura sobre PostgreSQL)

Ola B1 de Relevo (semana 2). Lee antes: `docs/ARQUITECTURA.md` (§4.1 contratos,
§6 esquema), `docs/PLAN_DESARROLLO.md`, `CLAUDE.md`, y los reportes
`docs/orca/reports/A1_WEB_REPORT.md` y `A2_DB_REPORT.md` (el esqueleto web y la
base ya están fusionados en `main`).

## Objetivo

Servidor MCP propio en `mcp/` (SDK oficial de TypeScript) con las cuatro tools
de lectura de la semana 2, respondiendo con **datos reales del seed** de la base
del compose. `buscar_norma` en esta ola es **solo léxica** (la híbrida llega en
S3 con el servicio de embeddings).

## Archivos que PUEDES tocar (nada más)

- `mcp/**` (servidor, tools, tipos)
- `lib/db/**` (cliente postgres-js compartido)
- `tests/mcp/**`
- `package.json`, `package-lock.json` (solo AGREGAR dependencias y scripts;
  no cambies los scripts ni deps existentes), `vitest.config.ts` (solo agregar
  `tests/mcp/**` al include)
- `docs/orca/reports/B1_MCP_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `app/`, `components/`, `lib/*.ts` fuera de
`lib/db/`, `db/`, `data/`, `ml/`, `corpus/`, `docker-compose.yml`, `README.md`,
`CLAUDE.md`, `docs/*.md`, `tests/web/`.

## Requisitos

1. **Dependencias nuevas**: `@modelcontextprotocol/sdk`, `postgres`
   (postgres-js), `tsx` (dev). Nada más.
2. **`lib/db/cliente.ts`**: conexión postgres-js leyendo `DATABASE_URL` de
   entorno con el default local del proyecto
   (`postgresql://relevo:relevo@localhost:5432/relevo`); export de un factory
   con cierre limpio. SQL explícito, sin ORM.
3. **`mcp/servidor.ts`**: `McpServer` con transporte **stdio** (arranque:
   `npm run mcp` → `tsx mcp/servidor.ts`). Registra las cuatro tools con
   schemas Zod idénticos a los contratos de ARQUITECTURA §4.1:
   - `listar_empleados({equipo?, activo?})` → `{empleados: [{id, nombre, rol,
     equipo}]}`, orden por nombre.
   - `consultar_turnos({empleado?, desde, hasta, turno?})` → asignaciones con
     nombre del empleado, código y nombre del turno, fecha y estado; `empleado`
     acepta id numérico o nombre parcial (ILIKE); `desde`/`hasta` fechas ISO;
     valida `desde <= hasta` y rango máximo 92 días.
   - `consultar_ausencias({empleado?, desde, hasta, tipo?})` → ausencias con
     nombre, tipo, rango de fechas, estado y motivo (mismas reglas de
     `empleado` y fechas).
   - `buscar_norma({consulta, k=8})` → búsqueda léxica:
     `websearch_to_tsquery('spanish', es_unaccent($1))` contra `chunks.tsv`,
     ranking `ts_rank_cd`, join con `documentos`; devuelve
     `{resultados: [{chunk_id, ref, fuente, titulo, url, fragmento, score}]}`
     con `fragmento` = `ts_headline` en español (o los primeros 300
     caracteres). Deja `// S3:` comentado dónde entra la rama vectorial.
   Cada tool devuelve `structuredContent` JSON y maneja errores con mensajes en
   español (sin exponer el DSN).
4. **Anotaciones MCP**: todas las tools con `readOnlyHint: true`. Ningún tool
   de escritura en esta ola.
5. **Tests** (`tests/mcp/*.test.ts`, Vitest): usa el patrón cliente-servidor en
   memoria del SDK (`InMemoryTransport.createLinkedPair()`) para probar los
   contratos de las 4 tools de punta a punta contra la BD del compose con el
   seed aplicado:
   - `listar_empleados` devuelve 40 y filtra por equipo (20/10/10).
   - `consultar_turnos` de un empleado del seed en una semana concreta devuelve
     sus asignaciones y respeta el filtro `turno`.
   - `consultar_ausencias` filtra por tipo y rango.
   - `buscar_norma`: como `chunks` puede estar vacío en `main`, el test inserta
     2 chunks fixture (embedding NULL, texto sobre «recargo nocturno» y
     «descanso dominical»), consulta «recargo nocturno», verifica ranking y
     limpieza (borra sus fixtures al final).
   - Validación: fechas invertidas → error Zod/mensaje, no crash.
   Si no hay BD accesible, `describe.skipIf` con mensaje claro; el reporte debe
   mostrar la corrida CON base activa (`docker compose up -d db` +
   `db/migrate.py` + `db/seed.py` ya documentados en A2; el venv raíz `.venv`
   ya existe con psycopg).
6. **Calidad**: TypeScript estricto, ESLint del repo debe pasar sin
   excepciones nuevas; español en mensajes y comentarios; UTF-8 sin BOM; sin
   secretos (el default local no es secreto).

## Gates (en ESTE worktree, uno a la vez)

```
docker compose up -d db   (y migrar/sembrar si la BD está vacía)
npm ci
npm run lint
npm test
npm run build
```

## Entrega

- Reporte `docs/orca/reports/B1_MCP_REPORT.md`: decisiones, salida LITERAL de
  los tres gates npm (con la BD activa en los tests MCP) y hash del commit
  (indica que el hash definitivo es `git rev-parse HEAD`).
- Commit único: `feat(mcp): servidor MCP con tools de lectura (B1)`
- Sin push, sin merge, sin PR. `docker compose down` al terminar.
