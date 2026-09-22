# Reporte F1 — evaluación

Worktree `f1-evaluacion`, rama `david-botero10/f1-evaluacion`, base `db35550`.
No se apagó ni se re-sembró PostgreSQL. No se escribió en `empleados`,
`asignaciones` ni `ausencias`. No había `XAI_API_KEY` en el entorno ni un
`.env` en este worktree.

## Resumen de las cuatro métricas

| Métrica | Valor de esta corrida | Pendiente |
|---|---|---|
| 1. Extracción (n=65) | total base 3.08 %, v1 76.92 % IC [66.15, 87.69], v2 83.08 % IC [73.85, 90.77], delta v1→v2 +6.15 pp | Grok: sin `XAI_API_KEY` |
| 2. Citas (20 preguntas, modo híbrida) | recall@3 97.50 %, @5 100 %, @8 100 %, MRR 0.933 | Juez LLM: sin `XAI_API_KEY` |
| 3. Auditor (20 escenarios) | 20/20. Precisión 100 % en aprobado (3), observaciones (9) y rechazado (8). Matriz diagonal | Nada de esta corrida |
| 4. Aprobación | Simulador 75.83 % sin corrección (91/120). 29 corregidas. 0 rechazos | Humanos: 0 propuestas. Falta el protocolo |

Los intervalos de v1 y v2 se solapan. El +6.15 pp no se separa del ruido.
El DPO sube `quitar` (total 50 % → 70 %, acción 50 % → 90 %) y no mueve la
F1 de fechas. En fechas absolutas (n=5) la acción de v2 llega a 80 % y la
exactitud total sigue en 0 %. Coincide con la tabla de E2: es otra corrida
del mismo test congelado, no una copia pegada del informe anterior.

Detalle, subgrupos y los tres párrafos: `evaluacion/extraccion.md`.
Citas: `evaluacion/citas.md`. Auditor: `evaluacion/auditor.md`.
Aprobaciones: `evaluacion/aprobaciones.md`. Protocolo:
`evaluacion/PROTOCOLO_USUARIOS.md`.

## Excepción de archivo

`vitest.config.ts` no está en la lista de la spec. El coordinador autorizó
una sola línea en el `include`, sin reordenar el resto:

```text
"tests/evaluacion/**/*.test.ts"
```

Sin esa línea `npm test` no ejecuta `tests/evaluacion/**`. Es la única
excepción.

## Qué quedó pendiente y por qué

- Columna Grok de la extracción y juez de citas: no hay `XAI_API_KEY`.
  `npm run eval:extraccion` y `npm run eval:citas` las completan cuando la
  clave está en el entorno o en `.env`. No imprimen la clave.
- Tasa humana y regresión entre versiones con usuarios: las 120 propuestas
  son `usuario = simulador` (91 aprobadas, 29 corregidas). El protocolo y
  `evaluacion/sesiones/plantilla.csv` quedan listos. `npm run eval:aprobaciones`
  se vuelve a correr después de las sesiones.
- El seed tiene 0 empleados con `activo = false`. `f1-no-activo` usa el id
  999998, que el auditor trata con la misma regla («no existe o no está
  activo»). No se insertó nadie.
- Los adapters no están en este worktree (siguen en `../e2-dpo/ml/models/`,
  gitignored). La corrida de extracción apuntó ahí. `npm run eval:extraccion`
  usa `ml/models/` si el `adapter_config.json` está, y si no ese hermano.

## Gates

En este worktree, uno por uno. Exit code 0 en los cinco.

```text
npm ci
```

```text
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 575 packages, and audited 576 packages in 52s

189 packages are looking for funding
  run `npm fund` for details

9 vulnerabilities (7 moderate, 2 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

```text
npm run lint
```

```text
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

```text
npm test
```

```text
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/f1-evaluacion


 Test Files  23 passed (23)
      Tests  102 passed (102)
   Start at  22:23:16
   Duration  10.28s (transform 3.89s, setup 18.16s, import 30.04s, tests 15.14s, environment 38.29s)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f1-evaluacion\db
configfile: pyproject.toml
plugins: anyio-4.14.2, Faker-40.37.0
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 0.97s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f1-evaluacion\ml
configfile: pyproject.toml
plugins: anyio-4.14.2, Faker-40.37.0
collected 49 items

ml\tests\test_chunking.py ......                                         [ 12%]
ml\tests\test_dpo_comparar.py ....                                       [ 20%]
ml\tests\test_dpo_pares.py ......                                        [ 32%]
ml\tests\test_dpo_simulador.py .....                                     [ 42%]
ml\tests\test_evals.py .                                                 [ 44%]
ml\tests\test_extractor.py ......                                        [ 57%]
ml\tests\test_manifiesto.py ....                                         [ 65%]
ml\tests\test_ordenes.py .............                                   [ 91%]
ml\tests\test_servir_extractor.py ..                                     [ 95%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================== warnings summary ===============================
.venv\Lib\site-packages\fastapi\testclient.py:1
  C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f1-evaluacion\.venv\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 49 passed, 1 warning in 2.47s ========================
```

```text
npm run build
```

```text
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 10.2s

./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/@ai-sdk/openai-compatible/dist/index.mjs
./node_modules/@ai-sdk/xai/dist/index.mjs
./lib/agente/modelo.ts
./lib/agente/asistente.ts
./lib/guardrails/escritura.ts

./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/@ai-sdk/xai/dist/index.mjs
./lib/agente/modelo.ts
./lib/agente/asistente.ts
./lib/guardrails/escritura.ts

./node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/ai/dist/index.mjs
./app/api/chat/route.ts

 ✓ Compiled successfully in 26.1s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
   Generating static pages (1/4)
   Generating static pages (2/4)
   Generating static pages (3/4)
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                    63.9 kB         166 kB
├ ○ /_not-found                            995 B         104 kB
├ ƒ /api/chat                              133 B         103 kB
├ ƒ /api/perfil                            133 B         103 kB
├ ƒ /api/propuestas/[id]                   133 B         103 kB
└ ƒ /api/propuestas/[id]/decision          133 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.97 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

El aviso de `@ai-sdk/provider-utils` ya estaba antes de esta ola.

```text
.venv/Scripts/python -m ruff check ml data evaluacion
```

```text
All checks passed!
```

Esa salida de ruff es posterior a un ajuste de prosa en
`evaluacion/evaluar_extraccion.py` (puntos entre subgrupos). No toca
TypeScript. `npm run lint`, `npm test` y `npm run build` ya habían salido
en verde sobre el mismo código de tests y de scripts.

## Hash

El hash de esta ola es la salida de `git rev-parse HEAD` en este worktree
(rama `david-botero10/f1-evaluacion`) después del commit único. El informe
va en ese mismo commit; no se hace amend para incrustar el SHA.
