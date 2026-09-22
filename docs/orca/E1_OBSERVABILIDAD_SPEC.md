# Spec E1 — observabilidad (OpenTelemetry → Arize Phoenix, memoria y perfil, guardrails)

Ola E1 de Relevo (semana 4). Lee antes: `docs/ARQUITECTURA.md` (§4.3 memoria/
perfil y guardrails, §8 observabilidad), `CLAUDE.md`, y el código vigente:
`lib/agente/*` (asistente, router, flujo-escritura, mcp), `mcp/servidor.ts`,
`auditor/servidor.ts`, `app/api/**`, `db/migrations/0003_gobernanza.sql`
(tablas `perfiles`, `conversaciones`, `mensajes`).

## Objetivo

Que cada conversación sea una traza en **Arize Phoenix** (spans por turno,
tool-call MCP, veredicto A2A y decisión de tarjeta), que el asistente tenga
**memoria persistente por conversación y perfil de usuario** (rol y equipo
condicionan respuestas), y que los **guardrails** de runtime queden explícitos
y probados. Es la evidencia de «observabilidad, gobernanza y personalización»
del proyecto.

## Archivos que PUEDES tocar (nada más)

- `lib/observabilidad/**` (nuevo: `otel.ts`, `spans.ts`)
- `instrumentation.ts` (raíz, hook de Next.js) y `next.config.ts` (solo lo
  necesario para instrumentation)
- `lib/agente/asistente.ts`, `lib/agente/flujo-escritura.ts`,
  `lib/agente/mcp.ts`, `lib/agente/prompt.ts` (spans + memoria + guardrails;
  no cambies contratos existentes)
- `lib/memoria/**` (nuevo: conversaciones, mensajes, perfiles)
- `lib/guardrails/**` (nuevo)
- `app/api/chat/route.ts`, `app/api/propuestas/[id]/decision/route.ts` (solo
  para spans y memoria), `app/api/perfil/route.ts` (nuevo)
- `components/chat.tsx` (selector de usuario/perfil discreto + id de
  conversación persistido en `localStorage`)
- `auditor/servidor.ts` (solo añadir spans)
- `docker-compose.yml` (AGREGAR servicio `phoenix` con `arizephoenix/phoenix`
  puerto 6006; no cambies el servicio `db`)
- `package.json`/`package-lock.json` (agregar deps OTel: `@opentelemetry/api`,
  `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`,
  `@opentelemetry/sdk-trace-base`; y `@arizeai/openinference-semantic-conventions`
  si aporta atributos estándar)
- `.env.example` (`PHOENIX_COLLECTOR_ENDPOINT`, `OTEL_SERVICE_NAME`)
- `tests/web/**`, `tests/observabilidad/**`
- `docs/orca/reports/E1_OBSERVABILIDAD_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `mcp/consultas.ts`, `mcp/escrituras.ts`,
`mcp/esquemas.ts`, `db/migrations/*` existentes (si hace falta columna nueva:
`db/migrations/0006_memoria.sql` y dilo), `data/`, `ml/`, `corpus/`,
`docs/*.md`, `auditor/verificaciones.ts`, `lib/a2a/`. La ola E2 corre en
paralelo sobre `ml/` y `data/`.

## Requisitos

1. **OpenTelemetry → Phoenix**: `instrumentation.ts` registra el SDK de Node
   con exportador OTLP/HTTP a `PHOENIX_COLLECTOR_ENDPOINT` (default
   `http://localhost:6006/v1/traces`). Sin variable o con Phoenix caído, la
   app funciona igual (exportador silencioso; nada de errores en consola en
   cada request). `OTEL_SERVICE_NAME=relevo`.
   Spans con atributos OpenInference cuando apliquen (`openinference.span.kind`
   = `AGENT`/`LLM`/`TOOL`/`RETRIEVER`, `input.value`, `output.value`,
   `llm.model_name`), para que Phoenix los pinte bien:
   - `relevo.turno` (AGENT) por request de chat, con `conversacion_id`,
     `usuario`, `intencion`, `confianza`.
   - `relevo.router` (LLM) y `relevo.extraccion` (LLM, con `proveedor`).
   - `relevo.tool.<nombre>` (TOOL; `buscar_norma` como RETRIEVER con `modo`
     y `k`) alrededor de cada `llamarHerramienta`.
   - `relevo.auditoria` (AGENT, con `veredicto`) alrededor de la llamada A2A
     en el flujo; y en el servidor del auditor un span `auditor.verificar`.
   - `relevo.decision` en el endpoint de decisión (con `decision`).
   El AI SDK soporta `experimental_telemetry: { isEnabled: true }` en
   `streamText`/`generateObject`: actívalo para que los spans del modelo y
   tokens salgan también.
2. **Memoria de conversación** (`lib/memoria/`): el cliente envía
   `conversacion_id` (UUID generado y guardado en `localStorage`) y `usuario`.
   El backend crea la conversación si no existe (`conversaciones`), persiste
   cada mensaje del usuario y del asistente en `mensajes` (`contenido` JSONB
   con `parts` resumidas: texto, tools llamadas, propuesta_id), y al responder
   **recupera los últimos N=20 mensajes** de la BD como historial si el
   cliente manda menos (así la conversación sobrevive a un refresh).
   `propuestas.conversacion_id` se rellena al crear la propuesta (pásalo por
   el flujo sin cambiar el contrato MCP: añade el campo opcional en la entrada
   de `crear_propuesta` solo si ya existe en `mcp/esquemas.ts`; si no,
   actualízalo tú mismo desde el flujo con un UPDATE en `lib/memoria`).
3. **Perfil de usuario** (`perfiles`): `GET/PUT /api/perfil?usuario=`. Semilla
   por código de 3 perfiles sintéticos si la tabla está vacía:
   `coordinadora_enfermeria` (rol coordinador, equipo enfermeria),
   `jefe_vigilancia` (coordinador, vigilancia), `gerencia` (gerente, todos).
   El system prompt inyecta rol y equipo, y el **alcance**: un coordinador de
   equipo solo consulta/propone sobre su equipo (el guardrail de alcance
   filtra `listar_empleados`/`consultar_turnos`/`consultar_ausencias` por
   equipo y rechaza propuestas fuera de su equipo con mensaje claro);
   `gerencia` ve todo. Selector discreto de usuario en la UI (dropdown),
   persistido en `localStorage`.
4. **Guardrails** (`lib/guardrails/`), deterministas y con test cada uno:
   - Alcance por equipo (arriba).
   - Citas obligatorias: si la intención fue `consulta_norma` y la respuesta
     final no contiene ninguna referencia `[n]` ni se llamó `buscar_norma`,
     se anexa una nota visible «Esta respuesta no cita la norma; verifícala»
     (y un atributo `guardrail.citas=false` en el span).
   - Sin escritura directa: verificación en arranque de que el servidor MCP
     expuesto al modelo no registra ninguna tool de escritura de nómina (ya
     existe el test de invariante; conviértelo además en chequeo de arranque
     que lanza si falla).
   - Entrada: longitud máxima del mensaje (2 000 caracteres) y rechazo de
     mensajes vacíos con 400.
   - Rate limit básico en memoria por `usuario` (30 req/min) → 429.
5. **Tests** (sin red, sin Phoenix): spans se crean con un exportador en
   memoria (`InMemorySpanExporter`) y tienen los atributos exigidos para un
   turno simulado y un tool-call; memoria: persistir y recuperar historial
   (BD real 5432, con limpieza); perfil: seed y PUT; guardrails: alcance
   filtra por equipo, nota de citas se anexa, límite de longitud, rate limit.
   Mantén verdes los 70 tests existentes.
6. **Calidad**: español, UTF-8 sin BOM, sin secretos, TypeScript estricto.

## Gates (en ESTE worktree, BD activa en 5432)

```
npm ci && npm run lint && npm test && npm run build
```

## Entrega

- Reporte `docs/orca/reports/E1_OBSERVABILIDAD_REPORT.md`: decisiones, salida
  LITERAL de gates, y **evidencia real con Phoenix**: `docker compose up -d
  phoenix`, un turno de chat (sin clave xAI sirve el stream simulado; con
  clave, uno real) y una captura o volcado (`curl` al API de Phoenix o
  listado de spans por nombre) que muestre la traza. Hash = `git rev-parse HEAD`.
- Commit único: `feat(observabilidad): trazas OTel a Phoenix, memoria, perfil y guardrails (E1)`
- Sin push, sin merge, sin PR.
