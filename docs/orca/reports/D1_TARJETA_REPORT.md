# Reporte D1 — tarjeta

Worktree: `d1-tarjeta` (`david-botero10/d1-tarjeta`), base `08ba063`.

## Qué se hizo

El camino de escritura queda cerrado: una orden de escritura se extrae, se
valida con lecturas y se guarda como propuesta `pendiente`. La UI la muestra
en una tarjeta. Solo `POST /api/propuestas/[id]/decision` llama a
`ejecutarPropuesta`, en una transacción con `SET LOCAL ROLE relevo_escritor`.
`ejecutar_propuesta` no está entre las tools del modelo.

## Decisiones

- **Extracción** (`lib/agente/extraccion.ts`). `generateObject` sobre el modelo
  de chat (Grok, `RELEVO_MODELO` o `grok-4.6`). El prompt fija la fecha de hoy
  en America/Bogota y resuelve mañana, la otra semana, el finde y el puente
  con los festivos de Colombia 2026. Si `EXTRACTOR_URL` tiene valor, primero
  `POST {url}/extraer` con `{ orden, fecha_referencia }`. Un 200 con el JSON
  de extracción (o envuelto en `extraccion`) queda como `proveedor: "lora"`.
  Si falla o el JSON no cumple el contrato, se cae a Grok (`proveedor: "xai"`).
- **Contrato.** `Extraccion` es `{ empleado, turno, fechas, justificacion,
  accion, proveedor }`. `accion` vale `asignar | ausencia | quitar`, el mismo
  contrato que C3, más `proveedor`. En `registrar_ausencia` el discriminador
  sigue siendo `tipo: "registrar_ausencia"` (como `asignar_turno` en §4.2) y
  la categoría va en `tipo_ausencia`, porque `tipo` ya nombra la acción.
- **Ventana de 92 días.** Cada fecha de la acción tiene que caer a lo sumo a
  92 días de hoy, hacia adelante o hacia atrás. El rango de una ausencia
  tampoco puede pasar de 92 días. Así se puede proponer sobre el roster
  sembrado (agosto–septiembre de 2026) y sobre las semanas siguientes.
- **`crear_propuesta`.** Valida empleado activo, turno del catálogo y fechas.
  Adjunta en `contexto` los solapes con asignaciones no canceladas y las
  ausencias `aprobada`. Inserta `propuestas` con `estado = pendiente` y
  `usuario = coordinador` (la tool no recibe usuario). Anotación MCP
  `readOnlyHint: false`, `destructiveHint: false`. No escribe nómina.
- **`ejecutar_propuesta`.** Función de `mcp/escrituras.ts`, no registrada en
  el servidor MCP ni en `herramientas()`. En una transacción: `SET LOCAL ROLE
  relevo_escritor`, `SELECT … FOR UPDATE`, y si el estado no es `pendiente`
  lanza «La propuesta ya fue decidida» sin escribir. Aprobar escribe
  `propuestas.acciones`; corregir escribe `correccion`; rechazar no toca
  nómina. Las asignaciones nuevas salen con `origen = 'tarjeta'` y
  `propuesta_id`. `ausencias` no tiene columna `origen` en el esquema
  vigente: no se creó `0006` y la fila se liga solo con `propuesta_id` y
  `estado = aprobada`. Cancelar un turno hace `UPDATE` a `estado = cancelada`
  y pone `propuesta_id`, y deja el `origen` del seed. El par de preferencia
  usa `origen` `aprobacion | correccion | rechazo`. En aprobación, `elegida`
  es la extracción original y `rechazada` es null. En corrección o rechazo,
  `rechazada` es la extracción original; en corrección, `elegida` refleja las
  acciones corregidas.
- **Asistente.** Si el router dice `orden_escritura`, el backend extrae,
  llama `listar_empleados`, `consultar_turnos` y `consultar_ausencias`, luego
  `crear_propuesta`, y emite `data-propuesta` más el texto «Te propongo…,
  revisa la tarjeta». El system prompt ya no dice que la escritura no está
  disponible. `crear_propuesta` también está en `herramientas()` por si el
  modelo la llama en otro turno; `ejecutar_propuesta` no.
- **Tarjeta.** Orden, interpretación, tabla de acciones, avisos de contexto
  y «sin auditar» si `veredicto_auditor` es null. Corregir edita turno, tipo
  o fecha y puede quitar filas. Un veredicto `rechazado` deshabilita Aprobar
  (arquitectura §4.2) y deja Corregir y Rechazar. Al recargar, el GET no
  cuenta como solape las filas que escribió esa misma propuesta.
- **Usuario de la decisión.** La tarjeta envía `usuario: "coordinador"`. No
  hay sesión de login en esta ola.
- **Worker.** Esta sesión corre como Grok 4.7. No se bajó el modelo ni el
  esfuerzo de razonamiento. El modelo de chat del producto sigue siendo
  `grok-4.6`.

## Corrida manual

Propuesta creada con `npx tsx` sobre `crearPropuesta` (hoy fijado en
`2026-09-21`, empleado 1, turno M, `2026-09-28`):

```json
{"propuesta_id":"50ecf4bc-3401-4990-965a-ed873fb9f621","estado":"pendiente","acciones":[{"tipo":"asignar_turno","empleado_id":1,"turno":"M","fecha":"2026-09-28"}],"contexto":{"solapes_detectados":[],"ausencias_en_rango":[]}}
```

En el navegador de Orca, la tarjeta mostró la orden, a María Marcela Torres,
el 2026-09-28, Mañana, «sin auditar» y los botones. Corregir abrió el turno,
la fecha y Quitar. Cancelar edición volvió a la tabla. Aprobar dejó el texto
«Quedó aprobada. 1 asignación, 0 ausencias y 0 cancelaciones.» y deshabilitó
los tres botones.

`SELECT` de la fila escrita y del par:

```text
        nombre        | turno |   fecha    |   estado   | origen  |             propuesta_id
----------------------+-------+------------+------------+---------+--------------------------------------
 María Marcela Torres | M     | 2026-09-28 | programada | tarjeta | 50ecf4bc-3401-4990-965a-ed873fb9f621

  estado  | decision |   usuario   | par_origen | elegida_turno | rechazada_nula | prompt_texto
----------+----------+-------------+------------+---------------+----------------+----------------------------------------------------------------
 aprobada | aprobar  | coordinador | aprobacion | M             | t              | d1-manual: ponle la mañana a María Marcela el 28 de septiembre
```

Segunda decisión sobre el mismo id:

```text
409 {"error":"La propuesta ya fue decidida (estado=aprobada)."}
```

Después se borraron la asignación `origen = tarjeta`, la aprobación, el par y
la propuesta. Quedaron 0 filas `origen = tarjeta` y la asignación seed del
2026-09-21 de María Marcela sigue `programada`.

La página de chat, en ancho de escritorio y a 390×844, sigue mostrando los
ejemplos. Sin `XAI_API_KEY` en este worktree, el ejemplo del turno de noche
respondió el stream simulado («Soy Relevo»).

## Gates

En este worktree, con PostgreSQL en `localhost:5432`. El `npm run dev` se
detuvo antes del build. El aviso de webpack es de `node_modules`
(`@ai-sdk/xai`), igual que en C1; el exit code es 0.

### `npm ci`

```text
added 511 packages, and audited 512 packages in 49s

186 packages are looking for funding
  run `npm fund` for details

9 vulnerabilities (7 moderate, 2 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

Exit code 0. También avisó que `eslint@9.39.5` está deprecado.

### `npm run lint`

```text
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

Exit code 0. ESLint no imprimió hallazgos. La línea verde es ruff sobre
`db`, `data` y `ml`.

### `npm test`

```text
> relevo@0.1.0 test
> node scripts/gates.mjs test

 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/d1-tarjeta

 ✓ tests/mcp/hibrida.test.ts (5 tests) 296ms
 ✓ tests/web/extraccion.test.ts (4 tests) 85ms
 ✓ tests/web/invariante.test.ts (2 tests) 54ms
 ✓ tests/web/flujo-escritura.test.ts (3 tests) 13ms
 ✓ tests/mcp/tools.test.ts (5 tests) 197ms
 ✓ tests/mcp/propuestas.test.ts (14 tests) 568ms
 ✓ tests/web/router.test.ts (4 tests) 18ms
 ✓ tests/web/api-chat.test.ts (3 tests) 155ms
 ✓ tests/web/fuentes.test.tsx (2 tests) 269ms
 ✓ tests/web/pagina.test.tsx (1 test) 242ms
 ✓ tests/web/tarjeta.test.tsx (5 tests) 705ms
 ✓ tests/web/chat.test.tsx (1 test) 911ms

 Test Files  12 passed (12)
      Tests  49 passed (49)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\d1-tarjeta\db
configfile: pyproject.toml
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 0.83s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\d1-tarjeta\ml
configfile: pyproject.toml
collected 12 items

ml\tests\test_chunking.py ......                                         [ 50%]
ml\tests\test_manifiesto.py ....                                         [ 83%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================= 12 passed in 0.86s ==============================
```

Exit code 0.

### `npm run build`

```text
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 9.5s

./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

 ✓ Compiled successfully in 25.4s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                    63.2 kB         166 kB
├ ○ /_not-found                            993 B         104 kB
├ ƒ /api/chat                              131 B         103 kB
├ ƒ /api/propuestas/[id]                   131 B         103 kB
└ ƒ /api/propuestas/[id]/decision          131 B         103 kB
```

Exit code 0.

## Commit

Mensaje: `feat(tarjeta): propuesta, tarjeta de aprobación y ejecución gobernada (D1)`

El hash definitivo es `git rev-parse HEAD` en este worktree (rama
`david-botero10/d1-tarjeta`). Sin push ni merge.
