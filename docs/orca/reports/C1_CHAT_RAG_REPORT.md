# Reporte C1 — chat-rag

Worktree: `c1-chat-rag` (`david-botero10/c1-chat-rag`), base `9d9b939`.

## Qué se hizo

El chat deja de depender solo del texto simulado cuando hay `XAI_API_KEY`:
Grok 4.6 (`@ai-sdk/xai`) responde con router de intención, tools MCP de lectura
y RAG híbrido. Sin clave, el stream simulado de la semana 2 sigue y pide
configurar la clave. La escritura con tarjeta no entra en esta ola: si la
intención es `orden_escritura`, el system prompt exige decirlo y no afirmar
que el cambio ya quedó hecho.

## Decisiones

- Cliente MCP en proceso (`lib/agente/mcp.ts`): `InMemoryTransport.createLinkedPair()`
  + `crearServidor(sql)`, perezoso y único por proceso. Las tools del AI SDK
  solo llaman `cliente.callTool`.
- Modelo: `RELEVO_MODELO` o `grok-4.6`. La clave se lee de `process.env.XAI_API_KEY`
  y no se escribe en código, logs ni tests. `streamText` con `stopWhen: stepCountIs(6)`.
- Router (`generateObject` + Zod): `charla | consulta_datos | consulta_norma | orden_escritura`,
  confianza y razón. Se antepone al system prompt como guía (no bloquea tools)
  y viaja en el data part `data-intencion`. En tests se inyecta `generar` y no hay red.
  Si la clasificación falla, se usa un fallback de charla y la respuesta sigue.
- `buscar_norma`: embedding HTTP (`EMBED_SERVICE_URL`, default `http://localhost:8631`)
  con tope de 3 s; vector `<=>` top 30 (índice HNSW) + léxica top 30; fusión RRF
  k=60; top 20; re-rank si `POST /rerank` responde 200; top `k`. Si el embed no
  responde, solo léxica y `modo: "lexica"`. Nunca se propaga el fallo del servicio.
  El contrato anterior gana el campo `modo` (`hibrida` | `lexica`).
- `ml/servir.py`: FastAPI en CPU. `POST /embed` reutiliza
  `corpus_lib.embeddings.calcular_embeddings` (bge-m3, 1024, normalizado).
  `POST /rerank` carga `BAAI/bge-reranker-v2-m3` solo si ya está en la caché de
  Hugging Face; si no, responde 501 y el TS sigue sin re-ranker. `GET /salud`.
- UI: chip con la intención, panel «Fuentes» numerado (fuente, ref, título como
  enlace a la URL) en el orden de `buscar_norma`, e indicador «consultando norma…».
- El build de Next comparte `.next` con `next dev`. Con el dev server arriba el
  gate falla por ENOENT / `_document`. El `npm run build` de abajo se corrió con
  ese proceso detenido. El warning de webpack es de `node_modules` (`@ai-sdk/xai`),
  igual que el de `ai` en olas anteriores; el exit code es 0.

## Cómo arrancar el servicio de embeddings

Venv de ML fuera del clone (el de la indexación). Si se creó antes de esta ola,
instalar las deps nuevas (fastapi y uvicorn ya están en `ml/requirements.txt`):

```text
..\relevo-ml-venv\Scripts\pip install -r ml/requirements.txt
npm run embed:dev
```

`npm run embed:dev` ejecuta, desde la raíz del repo, con `CUDA_VISIBLE_DEVICES` vacío:

```text
..\relevo-ml-venv\Scripts\python.exe -m uvicorn servir:app --app-dir ml --host 127.0.0.1 --port 8631
```

En macOS/Linux el script usa `../relevo-ml-venv/bin/python`. Salud: `GET http://127.0.0.1:8631/salud` → `{"ok":true}`.

La primera carga de bge-m3 en CPU supera el tope de 3 s del cliente: esa consulta
degrada a léxica mientras el proceso termina de cargar. Con el modelo ya en
memoria, la misma consulta queda en `modo: "hibrida"` (en esta máquina, ~0,3 s).
En el humo, `POST /rerank` respondió 501 (el re-ranker no está descargado); los
scores son los de RRF.

## Humo — `buscar_norma` híbrida, sin clave xAI

Servicio embed arriba. Llamada directa a `buscarNorma` (la función de la tool)
con `{ consulta: "recargo nocturno", k: 8 }`. `modo: "hibrida"`. Los 3 primeros:

```json
{
  "modo": "hibrida",
  "ms": 322,
  "n": 8,
  "resultados": [
    {
      "chunk_id": 183,
      "ref": "art. 169",
      "fuente": "cst_pr005",
      "titulo": "Código Sustantivo del Trabajo (Secretaría del Senado, parte 005)",
      "url": "http://www.secretariasenado.gov.co/senado/basedoc/codigo_sustantivo_trabajo_pr005.html",
      "fragmento": "TITULO VI. CAPITULO III.\nARTICULO 169. BASE DEL <b>RECARGO</b> <b>NOCTURNO</b>.\nTodo <b>recargo</b> o sobre-remuneración por concepto de trabajo <b>nocturno</b> se determina por el promedio de la misma o equivalente labor ejecutada durante el día. Si no existiere ninguna actividad del mismo establecimiento que fuere equiparable",
      "score": 0.03200204813108039
    },
    {
      "chunk_id": 182,
      "ref": "art. 168",
      "fuente": "cst_pr005",
      "titulo": "Código Sustantivo del Trabajo (Secretaría del Senado, parte 005)",
      "url": "http://www.secretariasenado.gov.co/senado/basedoc/codigo_sustantivo_trabajo_pr005.html",
      "fragmento": "nuevo texto es el siguiente:>\n1. El trabajo <b>nocturno</b> por el solo hecho de ser <b>nocturno</b> se remunera con un <b>recargo</b> del treinta y cinco por ciento (35%) sobre el valor del trabajo diurno, con excepción del caso de la jornada de treinta y seis (36) horas semanales previstas",
      "score": 0.03177805800756621
    },
    {
      "chunk_id": 175,
      "ref": "art. 161",
      "fuente": "cst_pr005",
      "titulo": "Código Sustantivo del Trabajo (Secretaría del Senado, parte 005)",
      "url": "http://www.secretariasenado.gov.co/senado/basedoc/codigo_sustantivo_trabajo_pr005.html",
      "fragmento": "podrá distribuirse de manera variable. Si en el horario pactado el trabajador o trabajadora debe laborar en jornada <b>nocturna</b>, tendrá derecho al pago de <b>recargo</b> <b>nocturno</b>.\nSe establecen las siguientes excepciones:\na) El empleador y el trabajador o la trabajadora podrán acordar que la jornada semanal de cuarenta",
      "score": 0.03009207275993712
    }
  ]
}
```

## Gates

### `npm ci`

```text
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 511 packages, and audited 512 packages in 44s

186 packages are looking for funding
  run `npm fund` for details

9 vulnerabilities (7 moderate, 2 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

Código de salida 0.

### `npm run lint`

```text
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

Código de salida 0. ESLint no imprime nada si no hay hallazgos; la línea verde es ruff (`db`, `data`, `ml`).

### `npm test`

```text
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/c1-chat-rag

 ✓ tests/mcp/hibrida.test.ts (5 tests) 805ms
     ✓ RRF mezcla un hit vectorial y uno léxico  325ms
 ✓ tests/mcp/tools.test.ts (5 tests) 438ms
     ✓ buscar_norma rankea el fixture de recargo nocturno y limpia  329ms
 ✓ tests/web/fuentes.test.tsx (2 tests) 271ms
 ✓ tests/web/router.test.ts (4 tests) 21ms
 ✓ tests/web/api-chat.test.ts (3 tests) 174ms
 ✓ tests/web/pagina.test.tsx (1 test) 287ms
 ✓ tests/web/chat.test.tsx (1 test) 892ms
     ✓ el input envía mensajes  890ms

 Test Files  7 passed (7)
      Tests  21 passed (21)
   Start at  18:05:01
   Duration  37.42s (transform 1.28s, setup 17.28s, import 16.54s, tests 2.89s, environment 154.08s)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\c1-chat-rag\db
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 0.95s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\c1-chat-rag\ml
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 12 items

ml\tests\test_chunking.py ......                                         [ 50%]
ml\tests\test_manifiesto.py ....                                         [ 83%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================= 12 passed in 1.04s ==============================
```

Código de salida 0.

### `npm run build`

```text
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 6.3s

./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/@ai-sdk/openai-compatible/dist/index.mjs
./node_modules/@ai-sdk/xai/dist/index.mjs
./lib/agente/modelo.ts
./app/api/chat/route.ts

./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/@ai-sdk/xai/dist/index.mjs
./lib/agente/modelo.ts
./app/api/chat/route.ts

 ✓ Compiled successfully in 11.0s
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
┌ ○ /                                    60.9 kB         163 kB
├ ○ /_not-found                            993 B         104 kB
└ ƒ /api/chat                              123 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.97 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Código de salida 0.

## Archivos tocados (solo los de la spec)

- `app/api/chat/route.ts`
- `components/chat.tsx`, `components/mensaje-asistente.tsx`
- `lib/cuerpo-chat.ts`, `lib/agente/**`
- `mcp/consultas.ts`, `mcp/esquemas.ts`, `mcp/servidor.ts`
- `ml/servir.py`, `ml/requirements.txt` (fastapi, uvicorn)
- `tests/web/**`, `tests/mcp/hibrida.test.ts`
- `package.json`, `package-lock.json` (`@ai-sdk/xai`, script `embed:dev`)
- `.env.example`
- `docs/orca/reports/C1_CHAT_RAG_REPORT.md`

## Commit

Mensaje: `feat(chat): asistente Grok con router, RAG híbrido y citas (C1)`

El hash definitivo es `git rev-parse HEAD` en este worktree (rama
`david-botero10/c1-chat-rag`). Sin push ni merge.
