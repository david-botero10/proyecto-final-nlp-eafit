# Reporte B1 — mcp-server

Worktree: `b1-mcp` (`david-botero10/b1-mcp`), base `fc86f71`.

## Qué se hizo

Servidor MCP de **solo lectura** sobre PostgreSQL del compose, con las cuatro tools de la semana 2:

- `lib/db/cliente.ts`: factory postgres-js (`DATABASE_URL` o DSN local) y cierre del pool.
- `mcp/servidor.ts`: `McpServer` + transporte stdio (`npm run mcp` → `tsx mcp/servidor.ts`).
- Tools: `listar_empleados`, `consultar_turnos`, `consultar_ausencias`, `buscar_norma` (léxica).
- Tests de punta a punta en `tests/mcp/tools.test.ts` con `InMemoryTransport.createLinkedPair()` contra el seed.

No se tocó `.gitignore`, `app/`, `components/`, `lib/*.ts` fuera de `lib/db/`, `db/`, `data/`, `ml/`, `corpus/`, `docker-compose.yml`, `README.md`, `CLAUDE.md`, `docs/*.md` ni `tests/web/`. Sin secretos ni `.env`.

## Decisiones

- Dependencias nuevas (solo agregar): `@modelcontextprotocol/sdk`, `postgres`, `tsx` (dev). Script nuevo `mcp`; no se alteraron scripts ni deps existentes.
- Contratos Zod alineados con ARQUITECTURA §4.1. `empleado` acepta id numérico o nombre parcial (`ILIKE`). `desde`/`hasta` ISO; `desde <= hasta` y máximo 92 días (error Zod, sin crash).
- `buscar_norma` usa `websearch_to_tsquery('spanish', es_unaccent($1))` contra `chunks.tsv`, `ts_rank_cd` y `ts_headline` en español (si el headline queda vacío, primeros 300 caracteres). Comentario `// S3:` marca dónde entra la rama vectorial.
- Anotaciones MCP: `readOnlyHint: true` en las cuatro tools. Ningún tool de escritura.
- Errores en español; el DSN no se registra ni se devuelve.
- `docker compose up -d db` en este worktree falló: el puerto 5432 ya lo ocupa `proyectofinalnlp2026-db-1` (`pgvector/pgvector:pg17`, healthy), el compose del checkout padre. No se editó `docker-compose.yml`. Las pruebas corrieron contra esa instancia en `localhost:5432` (mismas credenciales locales). `db/migrate.py` omitió las cinco migraciones (ya aplicadas). Seed ya presente: turnos=3, empleados=40, asignaciones=1837, ausencias=30, chunks=0. `docker compose down` de este worktree no detuvo la BD del padre.

## Gates (literales, uno a la vez, BD activa)

### `npm ci`

```
> npm ci

npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 507 packages, and audited 508 packages in 51s
```

Código de salida 0.

### `npm run lint`

```
> relevo@0.1.0 lint
> eslint .

```

Salida vacía. Código de salida 0.

### `npm test`

```
> relevo@0.1.0 test
> vitest run


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/b1-mcp


 Test Files  4 passed (4)
      Tests  9 passed (9)
   Start at  15:37:23
   Duration  36.24s (transform 561ms, setup 7.58s, import 17.20s, tests 1.24s, environment 87.47s)
```

Código de salida 0. Suite MCP corrida **con base activa** (no hubo `describe.skipIf`). 4 tests web de A1 + 5 tests MCP.

### `npm run build`

```
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 3.3s

./node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/ai/dist/index.mjs
./app/api/chat/route.ts

 ✓ Compiled successfully in 5.7s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/5) ...
   Generating static pages (1/5) 
   Generating static pages (2/5) 
   Generating static pages (3/5) 
 ✓ Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                    59.9 kB         162 kB
├ ○ /_not-found                            994 B         104 kB
└ ƒ /api/chat                              123 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.97 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Código de salida 0. El warning de webpack es el mismo de A1 (`node_modules`).

## Archivos tocados (solo los de la spec)

- `lib/db/cliente.ts`
- `mcp/esquemas.ts`, `mcp/consultas.ts`, `mcp/servidor.ts`
- `tests/mcp/tools.test.ts`
- `package.json`, `package-lock.json` (deps y script `mcp` agregados)
- `vitest.config.ts` (`tests/mcp/**/*.test.ts` en `include`)
- `docs/orca/reports/B1_MCP_REPORT.md`

## Commit

Mensaje: `feat(mcp): servidor MCP con tools de lectura (B1)`

El hash definitivo es el de `git rev-parse HEAD` en este worktree (rama `david-botero10/b1-mcp`).
