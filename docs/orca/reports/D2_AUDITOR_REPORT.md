# Reporte D2 — auditor A2A

Ola D2 en el worktree `david-botero10/d2-auditor`. El auditor es un servicio
HTTP propio (sin SDK A2A). No escribe nómina: solo lee con tools MCP y el rol
`relevo_lector`. El asistente todavía no lo llama; el cliente queda listo en
`lib/a2a/cliente.ts` con la firma
`auditarPropuesta(propuesta): Promise<VeredictoAuditor | null>`.

## Decisiones

- Protocolo mínimo sobre `node:http`. No se añadió ningún SDK: el contrato de
  la spec cabe en JSON-RPC 2.0 y la Agent Card.
- `GET /.well-known/agent.json` devuelve la tarjeta con `name: "Relevo Auditor"`,
  `capabilities.streaming: false` y la skill `auditar_propuesta`
  (`application/json` de entrada y de salida).
- `POST /a2a` acepta `message/send`. `params.message.parts[0]` es
  `{kind: "data", data: solicitud_auditoria}`. El `result` de JSON-RPC es la
  tarea: `status.state: "completed"` y
  `artifacts[0].parts[0].data` es el `veredicto_auditoria` de
  `docs/ARQUITECTURA.md` §4.2.
- Errores en español: `-32700` JSON inválido, `-32600` petición inválida,
  `-32601` método desconocido, `-32602` parámetros inválidos, `-32603` fallo
  interno sin DSN ni secretos, `-32001` en `tasks/get` («no persistido»).
- Veredicto por reglas, no por el modelo: `rechazado` si el empleado no existe
  o no está activo, o si hay solape duro (otro turno el mismo día, turno dentro
  de ausencia aprobada, ausencia que pisa turnos activos). `observaciones` si
  hay domingo, festivo, turno noche, más de 6 días, más de 44 h, o la semana
  queda en el límite. `aprobado` si todo pasa.
- Tope semanal en `auditor/horas.ts`: `HORAS_SEMANA_MAXIMAS = 44`, citado como
  lo pide la spec (Ley 2101 de 2021, 44 h desde julio de 2026). El art. 161
  indexado, tras la Ley 2466 de 2025, enuncia 42 h como meta final; el umbral
  de esta ola es 44. Las horas salen de `turnos.hora_inicio` / `hora_fin`
  (mañana y tarde 8 h; noche 22:00–06:00, 8 h). `consultar_turnos` no trae las
  horas, así que el catálogo se lee con `SET ROLE relevo_lector`.
- Cuatro clientes MCP en proceso, distintos del asistente: empleados, solapes,
  jornada y normas. Cada conexión hace `SET ROLE relevo_lector`. Si el rol no
  puede adoptarse, las tools siguen siendo solo SELECT.
- Domingo y festivo se marcan sobre la acción de asignar turno. Festivos 2026
  en `auditor/festivos.ts` (Ley 51 de 1983, 18 fechas; el 2026-10-12 cae en
  lunes y no se traslada). El turno noche cuenta en la fecha de la asignación
  aunque cruce la medianoche.
- Norma citada solo cuando hace falta (dominical/festivo → art. 179, nocturno
  → art. 168, jornada excedida → art. 161). Se prefiere el chunk cuya `fuente`
  empieza por `cst`. Los ids son los del corpus, no inventados.
- Si hay `XAI_API_KEY` y no es un test (`VITEST`) ni `AUDITOR_RAZONES_LLM=0`,
  Grok redacta las razones y no puede cambiar el veredicto. Sin clave, o si
  el modelo falla, quedan las plantillas. Los tests borran la clave y apuntan
  `EMBED_SERVICE_URL` a un puerto cerrado para que `buscar_norma` quede en
  léxico, sin red externa.
- Acciones que entiende la solicitud, alineadas con D1 sin tocar `lib/tipos.ts`:
  `asignar_turno`, `registrar_ausencia` (`tipo_ausencia`, `fecha_inicio`,
  `fecha_fin`, `motivo`) y `cancelar_turno`. El campo `tipo` queda como
  discriminador de la acción.
- Dependencias npm: ninguna nueva. Script `auditor:dev` =
  `tsx auditor/servidor.ts`, puerto `AUDITOR_PORT` (default 8641).
  El cliente usa `AUDITOR_URL` (default `http://127.0.0.1:8641`) y
  `AUDITOR_TIMEOUT_MS` (default 8000). Si no hay respuesta, devuelve `null`.
- Este worktree no traía `.venv`. Se creó uno local con Python 3.11.16 e
  `requirements-dev.txt` para que `npm run lint` y `npm test` encuentren ruff
  y pytest. Está en `.gitignore`. No forma parte del commit.

## Ejemplo literal

Agent Card (`curl.exe -sS http://127.0.0.1:8641/.well-known/agent.json`):

```json
{"name":"Relevo Auditor","description":"Auditor independiente de propuestas de turnos y ausencias. Verifica empleado, solapes, jornada y recargos, y devuelve un veredicto.","url":"http://127.0.0.1:8641","version":"0.1.0","capabilities":{"streaming":false},"skills":[{"id":"auditar_propuesta","name":"Auditar propuesta","description":"Recibe una solicitud_auditoria y responde un veredicto_auditoria (aprobado, observaciones o rechazado).","inputModes":["application/json"],"outputModes":["application/json"]}]}
```

Request `POST /a2a` (domingo fuera del seed, empleado 2, turno M):

```json
{"jsonrpc":"2.0","id":"ejemplo-1","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"propuesta_id":"ejemplo-domingo","orden_texto":"Ponle la mañana el domingo 4 de octubre.","extraccion":{"empleado":"Elizabeth María López","turno":"M","fechas":["2026-10-04"],"justificacion":null},"acciones":[{"tipo":"asignar_turno","empleado_id":2,"turno":"M","fecha":"2026-10-04"}],"contexto":{"solapes_detectados":[],"ausencias_en_rango":[]}}}]}}}
```

Response literal (`curl.exe -sS -X POST http://127.0.0.1:8641/a2a`):

```json
{"jsonrpc":"2.0","id":"ejemplo-1","result":{"id":"b6a2a6cc-9326-43c5-ab27-1eacf0259695","contextId":"ejemplo-domingo","kind":"task","status":{"state":"completed"},"artifacts":[{"artifactId":"5f9e6296-1f8d-4bcf-85d6-61c0b4be012d","name":"veredicto_auditoria","parts":[{"kind":"data","data":{"propuesta_id":"ejemplo-domingo","veredicto":"observaciones","razones":["El 2026-10-04 es domingo: aplica recargo dominical."],"normas_citadas":[{"fuente":"cst_pr006","articulo":"179","chunk_id":193}],"verificaciones":{"empleado_existe":true,"sin_solapes":true,"jornada_dentro_de_limites":true}}}]}]}}
```

Los `id` de tarea y artefacto los genera el servidor en cada llamada.

## Diez escenarios

Todos contra el seed de `localhost:5432`, por el cliente HTTP real. Empleado 2
es Elizabeth María López (activo). En la semana del 2026-08-03 trabaja tarde
lun–vie y domingo, y libra el sábado. El periodo del seed termina el 2026-09-27,
así que septiembre 28 en adelante no tiene turnos previos.

| # | Escenario | Entrada | Veredicto obtenido |
|---|---|---|---|
| 1 | Empleado inexistente | 999999, M, 2026-09-28 | `rechazado` (`empleado_existe: false`) |
| 2 | Turno duplicado el mismo día | empleado 2, M, 2026-08-03 (ya tiene T) | `rechazado` (`sin_solapes: false`) |
| 3 | Turno dentro de ausencia aprobada | empleado 11, M, 2026-08-05 (incapacidad 08-03 a 08-07) | `rechazado` (ausencia aprobada) |
| 4 | Domingo | empleado 2, M, 2026-10-04 | `observaciones`, art. 179, chunk 193, fuente `cst_pr006` |
| 5 | Festivo | empleado 2, T, 2026-10-12 | `observaciones`, art. 179 citado |
| 6 | Turno noche | empleado 2, N, 2026-09-29 | `observaciones`, art. 168 citado; jornada dentro del límite |
| 7 | Séptimo día | empleado 2, M, 2026-08-08 | `observaciones`; 7 días y 56 h; `jornada_dentro_de_limites: false` |
| 8 | Ausencia sobre turnos activos | empleado 2, vacaciones 2026-08-03 a 2026-08-05 | `rechazado` (`sin_solapes: false`) |
| 9 | Propuesta limpia | empleado 2, M, 2026-09-28 | `aprobado`; sin normas citadas |
| 10 | Dos acciones, una en domingo | empleado 2, M el 2026-09-28 y M el 2026-10-04 | `observaciones`; sin solape; cita art. 179 |

El séptimo día no se rechaza: el solape duro no existe (el sábado estaba libre)
y la spec reserva `rechazado` para empleado ausente o solape. El límite semanal
queda en observaciones para que la tarjeta lo muestre.

## Gates

En este worktree, uno por uno. Código de salida 0 en los cuatro.
`npm run lint` corre ESLint y ruff; ESLint no imprime nada cuando está limpio.

### `npm ci`

```text
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 511 packages, and audited 512 packages in 1m

186 packages are looking for funding
  run `npm fund` for details

9 vulnerabilities (7 moderate, 2 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

### `npm run lint`

```text
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

### `npm test`

```text
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/d2-auditor

 ✓ tests/auditor/calendario.test.ts (4 tests) 11ms
 ✓ tests/mcp/hibrida.test.ts (5 tests) 318ms
 ✓ tests/auditor/cliente.test.ts (1 test) 39ms
 ✓ tests/mcp/tools.test.ts (5 tests) 186ms
 ✓ tests/auditor/protocolo.test.ts (5 tests) 115ms
 ✓ tests/auditor/escenarios.test.ts (10 tests) 384ms
 ✓ tests/web/router.test.ts (4 tests) 65ms
 ✓ tests/web/api-chat.test.ts (3 tests) 154ms
 ✓ tests/web/fuentes.test.tsx (2 tests) 536ms
     ✓ renderiza fuentes numeradas, el enlace y el chip de intención  521ms
 ✓ tests/web/pagina.test.tsx (1 test) 416ms
     ✓ renderiza el encabezado Relevo  412ms
 ✓ tests/web/chat.test.tsx (1 test) 1171ms
     ✓ el input envía mensajes  1167ms

 Test Files  11 passed (11)
      Tests  41 passed (41)
   Start at  18:57:54
   Duration  34.68s (transform 1.91s, setup 32.10s, import 28.98s, tests 3.39s, environment 138.97s)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\d2-auditor\db
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 1.04s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\d2-auditor\ml
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 12 items

ml\tests\test_chunking.py ......                                         [ 50%]
ml\tests\test_manifiesto.py ....                                         [ 83%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================= 12 passed in 0.82s ==============================
```

### `npm run build`

```text
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 11.2s

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

 ✓ Compiled successfully in 29.0s
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
├ ○ /_not-found                            994 B         104 kB
└ ƒ /api/chat                              123 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.96 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

El aviso de dependencia crítica viene de `@ai-sdk/xai` vía `lib/agente/modelo.ts`,
archivo que esta ola no toca. El build termina bien.

## Hash

El hash del commit único es la salida de `git rev-parse HEAD` en este worktree
(rama `david-botero10/d2-auditor`). No se enmienda el commit para incrustar el SHA.
