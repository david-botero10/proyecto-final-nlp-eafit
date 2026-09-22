# Reporte E1 — observabilidad

Ola E1 en el worktree `e1-observabilidad`, rama `david-botero10/e1-observabilidad`.
No hay push, PR ni merge. La base de `localhost:5432` (corpus ya indexado) no se
apagó ni se resembró. Phoenix se levantó aparte, en el proyecto compose de este
worktree, sin tocar el servicio `db`.

## Decisiones

- OpenTelemetry se registra en `instrumentation.ts` (runtime Node). El servicio
  se llama `relevo`. El collector por defecto es
  `http://localhost:6006/v1/traces`. Si Phoenix no responde, el exportador
  traga el fallo y no escribe en consola en cada request.
- Esta imagen de Phoenix (`arizephoenix/phoenix:latest`) responde **415** a
  OTLP/HTTP en JSON (`@opentelemetry/exporter-trace-otlp-http`) y **422** a un
  protobuf inválido con `Content-Type: application/x-protobuf`. El SDK usa por
  eso `@opentelemetry/exporter-trace-otlp-proto` contra el mismo URL. El
  paquete HTTP queda declarado porque la spec lo pide.
- `experimental_telemetry: { isEnabled: true }` está en el `streamText` de
  `lib/agente/asistente.ts`. `generateObject` vive en `lib/agente/router.ts` y
  `lib/agente/extraccion.ts`, que esta ola no puede editar. Esas llamadas
  quedan envueltas por los spans `relevo.router` y `relevo.extraccion` (kind
  LLM, con `proveedor` en la extracción).
- `crear_propuesta` en `mcp/esquemas.ts` no trae `conversacion_id`. No se tocó
  el contrato MCP. El flujo hace `UPDATE propuestas SET conversacion_id` desde
  `lib/memoria` después de crear la tarjeta.
- No hizo falta `db/migrations/0006_memoria.sql`: `perfiles`,
  `conversaciones`, `mensajes` y `propuestas.conversacion_id` ya están en
  `0003_gobernanza.sql`.
- Semilla de perfiles solo si `perfiles` está vacía: `coordinadora_enfermeria`
  (coordinador, enfermeria), `jefe_vigilancia` (coordinador, vigilancia),
  `gerencia` (gerente, todos). Un coordinador de equipo fuerza
  `listar_empleados` a su equipo, filtra turnos y ausencias, y rechaza
  propuestas de otro equipo. Gerencia no se recorta.
- Guardrails: mensaje vacío → 400; más de 2000 caracteres → 400; 30
  peticiones por minuto y usuario → 429; si `consulta_norma` no trae `[n]` ni
  llamó `buscar_norma`, se anexa «Esta respuesta no cita la norma; verifícala»
  y el span lleva `guardrail.citas=false`. El arranque
  (`afirmarSinEscrituraDirecta`) lanza si `ejecutar_propuesta` está entre las
  tools del modelo.
- `vitest.config.ts` no estaba en la lista de la spec. Sin la línea
  `tests/observabilidad/**/*.test.ts`, `npm test` no ejecutaría esos tests.
  Es el único archivo fuera de la lista.
- No había `.venv` en este worktree. Se creó uno local con Python 3.11.16 y
  `requirements-dev.txt` para ruff y pytest. Está en `.gitignore` y no entra
  en el commit.
- No hay `.env` en el worktree. El turno de evidencia es el stream simulado
  (sin `XAI_API_KEY`), como permite la spec.

## Gates

En este worktree, uno tras otro, sobre el árbol final.

### `npm ci`

```
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 575 packages, and audited 576 packages in 47s

189 packages are looking for funding
  run `npm fund` for details

9 vulnerabilities (7 moderate, 2 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

Exit 0.

### `npm run lint`

```
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

ESLint no imprimió hallazgos. La línea verde es ruff. Exit 0.

### `npm test`

```
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/e1-observabilidad


 Test Files  20 passed (20)
      Tests  83 passed (83)
   Start at  20:48:51
   Duration  32.16s (transform 5.31s, setup 76.86s, import 63.12s, tests 6.68s, environment 140.24s)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\e1-observabilidad\db
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 0.81s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\e1-observabilidad\ml
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 12 items

ml\tests\test_chunking.py ......                                         [ 50%]
ml\tests\test_manifiesto.py ....                                         [ 83%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================= 12 passed in 0.90s ==============================
```

83 tests de Vitest (los 70 previos más 13 de esta ola) y 18 de pytest. Exit 0.

### `npm run build`

```
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 7.8s

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

 ✓ Compiled successfully in 10.6s
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

Exit 0. El aviso de dependencia crítica sale de `@ai-sdk/xai` y `@ai-sdk/provider-utils`.
El chequeo de arranque importa el asistente, así que el aviso también aparece
por `lib/guardrails/escritura.ts`. El build termina bien. El log de
`next start` no escribió errores al atender el turno.

## Evidencia Phoenix

`docker compose up -d phoenix` creó `e1-observabilidad-phoenix-1` y publicó
`6006`. El log de Phoenix anuncia `OTLP over HTTP http://localhost:6006/v1/traces`.

Turno simulado (`POST http://127.0.0.1:3107/api/chat`, sin clave xAI), usuario
`gerencia`, `conversacion_id` `e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1`, texto
«¿Quién cubre el turno de la noche el sábado?». HTTP 200. El stream contiene
«Soy Relevo» y «configura XAI_API_KEY».

`GET http://127.0.0.1:6006/v1/projects/UHJvamVjdDox/spans?limit=20` (recorte
literal del span del turno):

```
{"id":"U3Bhbjo2","name":"relevo.turno","context":{"trace_id":"2bf8edb4059822cfa2b39b19e9b7d89d","span_id":"ce0e09f36cb790a7"},"span_kind":"AGENT","parent_id":"ca78e2f2facc902b","start_time":"2026-09-22T01:51:36.272000+00:00","end_time":"2026-09-22T01:51:36.314458+00:00","status_code":"OK","status_message":"","attributes":{"conversacion_id":"e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1","intencion":"sin_modelo","confianza":0,"usuario":"gerencia","output.value":"Soy Relevo. Aún no tengo modelo co
```

Phoenix pinta `span_kind: AGENT` a partir de `openinference.span.kind`. El
padre es el span de la ruta de Next (`POST /api/chat/route`), porque al
registrar el provider global Next engancha su propia traza. En la consola del
servidor no apareció ningún error de export.

La UI en `http://127.0.0.1:3107` muestra el selector (Coordinadora de
enfermería, Jefe de vigilancia, Gerencia). Se eligió Gerencia, se envió la
pregunta de ejemplo y la respuesta simulada citó el texto enviado. El encabezado
no desborda a 1022 px ni con el contenedor forzado a 360 px.

## Hash

El hash del commit único es la salida de `git rev-parse HEAD` en este worktree
(rama `david-botero10/e1-observabilidad`). No se enmienda el commit para
incrustar el SHA.
