# Reporte B2 — integracion

Worktree: `b2-integracion` (`david-botero10/b2-integracion`), base `c476b90`.

## Qué se hizo

Gates unificados TS+Python, `.env.example`, README de cero e indexación real
del corpus (bge-m3 → pgvector) **sin** `--limit`.

Archivos tocados (solo los de la spec):

- `README.md`
- `.env.example`
- `package.json` (scripts `lint`/`test`; `build`/`dev`/`mcp` igual)
- `scripts/gates.mjs`
- `requirements-dev.txt`
- `docs/orca/reports/B2_INTEGRACION_REPORT.md`

No se tocó `.gitignore`, `app/`, `components/`, `lib/`, `mcp/`, `tests/`,
`db/`, `data/`, `ml/`, `corpus/*.json`, `docker-compose.yml`, `CLAUDE.md`,
`docs/*.md` ni `docs/entrega/`. Sin secretos ni `.env`.

## Decisiones

- `scripts/gates.mjs` encadena las partes y, si una falla, imprime etiqueta +
  comando para reproducirla. Python: `.venv/Scripts/python.exe` si existe, si
  no `.venv/bin/python`, si no `python`. ESLint y Vitest se lanzan con
  `process.execPath` sobre los JS de `node_modules` (Windows, sin `.cmd`).
- `ruff check db data ml --target-version py311` en un solo paso: `ml/` pide
  py311 y no se toca `ml/pyproject.toml`.
- `requirements-dev.txt` une lo de ruff/pytest de `db/` y `ml/` **sin** torch
  ni FlagEmbedding.
- Venv de indexación **fuera del clone** (`../relevo-ml-venv`): un `.venv-ml`
  dentro del repo hace que ESLint/`next build` recorran JS de torch.
- Venv de gates en **Python 3.11.16**: con 3.10, `pytest ml/tests` explota
  (`from datetime import UTC`). El README lo documenta.
- `docker compose up -d db` en este worktree no bindea 5432: el puerto lo
  ocupa `proyectofinalnlp2026-db-1` (pgvector/pg17, healthy). No se editó el
  compose ni se apagó esa BD. Migraciones, seed, indexación y tests usaron
  `localhost:5432` (mismas credenciales). `python db/seed.py` sin flags falla
  si ya hay filas; el README documenta `--reseed`.
- Indexación: `--solo-descarga` (no había `corpus/raw/`) y luego
  `--desde-cache` sin `--limit`. CLI: 20 fuentes, 20 descargadas, 497 chunks
  insertados. En BD: **18 documentos** (CST + 17 partes) y **497 chunks**.
  `ley_2101_2021` y `ley_2466_2025` no dejaron filas en `documentos` (el
  chunker no produjo artículos insertables; no se tocó `ml/`).

## Verificación de novato

Se siguió el README **de cero** en este worktree: no había `.venv` ni
`node_modules` al arrancar. Se corrigió lo que no cuadraba (puerto 5432,
`--reseed`, venv de ML fuera del clone, Python 3.11 para gates) y se dejó
en el README.

## Indexación (BD del compose)

Salida de `python ml/indexar.py --solo-descarga`:

```
{
  "documentos": 20,
  "descargados": 20,
  "chunks": 0,
  "jsonl": null,
  "insertados_bd": 0
}
```

Salida de `python ml/indexar.py --desde-cache` (sin `--limit`):

```
{
  "documentos": 20,
  "descargados": 20,
  "chunks": 497,
  "jsonl": null,
  "insertados_bd": 497
}
```

Conteos SQL: `documentos=18`, `chunks=497`.

### 10 consultas (`buscar_norma`, mismo SQL que `mcp/consultas.ts`, primer hit)

| Consulta | Primer resultado |
|---|---|
| recargo nocturno | `ref=art. 161` · `fuente=cst_pr005` |
| trabajo dominical | `ref=art. 185` · `fuente=cst_pr006` |
| horas extras | `ref=art. 162` · `fuente=cst_pr005` |
| jornada máxima legal | `ref=art. 162` · `fuente=cst_pr005` |
| descanso obligatorio | `ref=art. 179` · `fuente=cst_pr006` |
| vacaciones anuales | `ref=art. 185` · `fuente=cst_pr006` |
| trabajo nocturno porcentaje | **sin resultado** |
| licencia de maternidad | `ref=art. 236` · `fuente=cst_pr007` |
| contrato de trabajo elementos | `ref=art. 23` · `fuente=cst` |
| reducción de jornada laboral | `ref=art. 161` · `fuente=cst_pr005` |

## Gates (literales, uno a la vez, BD activa)

### `npm run lint`

```
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

Código de salida 0.

### `npm test`

```
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/b2-integracion

 ❯ tests/mcp/tools.test.ts (5 tests | 1 failed) 136ms
     × buscar_norma rankea el fixture de recargo nocturno y limpia 45ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/mcp/tools.test.ts > tools MCP de lectura > buscar_norma rankea el fixture de recargo nocturno y limpia
AssertionError: expected 175 to be 510 // Object.is equality

- Expected
+ Received

- 510
+ 175

 ❯ tests/mcp/tools.test.ts:216:46
    214|       expect(filaRecargo).toBeDefined();
    215|       expect(filaRecargo?.score ?? 0).toBeGreaterThan(filaDominical?.s…
    216|       expect(cuerpo.resultados[0]?.chunk_id).toBe(recargo.id);
       |                                              ^
    217|       expect(filaRecargo?.fragmento.toLowerCase()).toMatch(/recargo/);
    218|     } finally {


 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 8 passed (9)
   Start at  16:24:59
   Duration  4.24s (transform 244ms, setup 1.32s, import 1.79s, tests 1.24s, environment 6.34s)


[gates] Falló: vitest (TypeScript)
[gates] Reproduce con: npx vitest run
```

Código de salida 1.

Causa: B1 asume `chunks` vacío y exige que el fixture art. 168 sea
`resultados[0]`. Con 497 chunks reales, `recargo nocturno` rankea
`chunk_id=175` (`art. 161`, `cst_pr005`). Esta ola **no puede** tocar
`tests/` ni `mcp/`. El fixture sí aparece en el top-k (la aserción
`toBeDefined()` pasa); solo falla «debe ser el primero».

Partes Python del mismo gate, reproducidas a mano (el script no llega
porque Vitest corta):

```
.\.venv\Scripts\python -m pytest db/tests
============================== 6 passed in 0.89s ==============================

.\.venv\Scripts\python -m pytest ml/tests
============================= 11 passed in 1.05s ==============================
```

### `npm run build`

```
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 9.0s

./node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/ai/dist/index.mjs
./app/api/chat/route.ts

 ✓ Compiled successfully in 33.9s
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
├ ○ /_not-found                            995 B         104 kB
└ ƒ /api/chat                              123 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.97 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Código de salida 0. El warning de webpack es el de A1 (`node_modules`).

## Commit

Mensaje: `feat(integracion): gates unificados, README y corpus indexado (B2)`

El hash definitivo es `git rev-parse HEAD` en este worktree (rama
`david-botero10/b2-integracion`). Valor del commit único antes de anotar
este párrafo: `a60ee24dcd22428995875a0b7e283c2ab4314068`. Si el amend del
reporte cambia el SHA, prevalece `git rev-parse HEAD`.

Pendiente de auditoría: relajar en B1/B2-hotfix la aserción
`resultados[0] === fixture` ahora que el corpus está indexado. La BD se
deja encendida.
