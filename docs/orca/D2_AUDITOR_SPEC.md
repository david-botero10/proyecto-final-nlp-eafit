# Spec D2 — auditor (agente auditor como servicio A2A)

Ola D2 de Relevo (semana 4). Lee antes: `docs/ARQUITECTURA.md` (§2 auditor,
§3.3, §4.2 mensajes A2A `solicitud_auditoria`/`veredicto_auditoria`),
`CLAUDE.md`, `lib/tipos.ts` (`VeredictoAuditor`, `Propuesta`), `mcp/*` (tools
de lectura y `buscar_norma`), `lib/agente/mcp.ts` (patrón de cliente MCP en
proceso), `lib/agente/modelo.ts`.

## Objetivo

El **segundo agente** del sistema: un auditor independiente que recibe cada
propuesta de escritura por el protocolo **A2A** (Agent Card + JSON-RPC sobre
HTTP), la verifica con sus propias lecturas MCP (rol de solo lectura) y la
norma recuperada, y devuelve un `veredicto_auditoria`. El asistente lo llama
antes de mostrar la tarjeta; su veredicto se persiste en
`propuestas.veredicto_auditor`. Si el auditor no responde, la tarjeta se
muestra con «sin auditar» (nunca se bloquea al usuario, pero se registra).

## Archivos que PUEDES tocar (nada más)

- `auditor/**` (nuevo: servicio A2A, `auditor/servidor.ts`, `auditor/verificaciones.ts`,
  `auditor/agent-card.ts`, `auditor/veredicto.ts`)
- `lib/a2a/**` (nuevo: cliente A2A del asistente y tipos de mensajes)
- `tests/auditor/**`
- `package.json` (solo scripts nuevos `auditor:dev` y deps si son
  estrictamente necesarias; documenta cuáles), `package-lock.json`
- `vitest.config.ts` (solo agregar `tests/auditor/**` al include)
- `.env.example` (documentar `AUDITOR_URL`, `AUDITOR_PORT`)
- `docs/orca/reports/D2_AUDITOR_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `app/`, `components/`, `lib/agente/**`,
`lib/tipos.ts`, `mcp/**`, `db/`, `data/`, `ml/`, `corpus/`, `docs/*.md`.
D1 corre en paralelo sobre esos archivos: el **enganche** del asistente con tu
cliente (`lib/a2a/cliente.ts`) lo hará el orquestador tras fusionar ambas
olas; tú entregas el cliente listo con la firma
`auditarPropuesta(propuesta): Promise<VeredictoAuditor | null>` (null si el
servicio no responde en `AUDITOR_TIMEOUT_MS`, default 8000).

## Requisitos

1. **Protocolo A2A** (implementación propia y mínima, sin SDK externo salvo
   que uno oficial de npm sea estable; si lo usas, justifica):
   - `GET /.well-known/agent.json` → **Agent Card** con `name: "Relevo Auditor"`,
     `description`, `url`, `version`, `capabilities: {streaming: false}`,
     `skills: [{id: "auditar_propuesta", name, description, inputModes:
     ["application/json"], outputModes: ["application/json"]}]`.
   - `POST /a2a` JSON-RPC 2.0: método `message/send` con un `message` cuyo
     `parts[0]` es `{kind: "data", data: <solicitud_auditoria>}`; responde un
     `task` con `status.state: "completed"` y `artifacts[0].parts[0].data =
     <veredicto_auditoria>`. Errores JSON-RPC estándar (-32600, -32601,
     -32602) con mensajes en español. `tasks/get` puede devolver
     «no persistido» (-32001) — no hace falta persistencia de tareas.
   - Ejecutable con `npm run auditor:dev` (`tsx auditor/servidor.ts`, puerto
     `AUDITOR_PORT` default 8641). Usa el módulo `http` de Node (sin
     Express) o el que ya exista en el repo.
2. **Verificaciones deterministas** (`auditor/verificaciones.ts`), cada una
   con su propio cliente MCP en proceso (mismo patrón de `lib/agente/mcp.ts`
   pero instancia propia; rol de BD `relevo_lector` vía `SET ROLE` si el
   cliente lo permite, o documenta que las tools ya son de solo lectura):
   - `empleado_existe` (y activo) para cada `empleado_id` de `acciones[]`.
   - `sin_solapes`: para `asignar_turno`, que no exista otra asignación
     activa del empleado ese día ni una ausencia aprobada que lo cubra; para
     `registrar_ausencia`, que no haya asignaciones activas en el rango.
   - `jornada_dentro_de_limites`: ≤ 6 días asignados por semana calendario
     tras aplicar las acciones; y, usando `turnos.hora_inicio/hora_fin`, que
     la semana no supere el máximo legal vigente (Ley 2101/2021: 44 h desde
     julio 2026 — pon el valor en una constante con comentario y cítalo).
   - `descanso_dominical`: si la acción cae en domingo o festivo colombiano
     (reutiliza `data/ordenes/festivos.py`? NO — es Python; crea
     `auditor/festivos.ts` con los festivos 2026, mismos datos), marca
     observación con recargo aplicable.
3. **Verificación normativa**: para las observaciones que lo ameriten
   (nocturno, dominical/festivo, horas extra), llama `buscar_norma` y adjunta
   `normas_citadas` con `{fuente, articulo, chunk_id}` reales. Si hay
   `XAI_API_KEY`, un paso opcional con Grok redacta las `razones` en español
   claro a partir de las verificaciones (nunca decide él: el veredicto sale
   de las reglas); sin clave, razones plantilla.
4. **Veredicto** (`auditor/veredicto.ts`): `rechazado` si empleado no existe
   o hay solape duro (dos turnos el mismo día, turno en ausencia aprobada);
   `observaciones` si hay dominical/festivo/nocturno/límite semanal cerca;
   `aprobado` si todo pasa. Devuelve exactamente el JSON de ARQUITECTURA §4.2.
5. **Cliente** (`lib/a2a/cliente.ts`): descubre la Agent Card (cacheada),
   envía `message/send`, valida la respuesta con Zod (`VeredictoAuditor`),
   timeout y `null` en fallo. Exporta también `solicitudDesdePropuesta()`.
6. **Tests** (`tests/auditor/`, BD real del 5432, sin red externa):
   - Agent Card responde y valida con Zod.
   - JSON-RPC: método desconocido → -32601; params inválidos → -32602.
   - **10 escenarios con trampa** (los del plan, métrica del auditor): empleado
     inexistente → rechazado; turno duplicado el mismo día → rechazado;
     turno dentro de ausencia aprobada del seed → rechazado; asignación en
     domingo → observaciones con norma citada (art. 179 CST o equivalente);
     asignación en festivo (p. ej. 2026-10-12) → observaciones; turno noche
     (N) → observaciones con recargo nocturno citado; 7.º día de la semana →
     observaciones/rechazado por límite; ausencia sobre días con turnos
     activos → rechazado; propuesta limpia → aprobado; propuesta con dos
     acciones mezcladas (una limpia, una en domingo) → observaciones.
     Levanta el servidor en un puerto libre dentro del test y usa el cliente
     real por HTTP.
   - Cliente: servicio caído → `null` sin lanzar.
7. **Calidad**: español, UTF-8 sin BOM, sin secretos, TypeScript estricto,
   ESLint limpio.

## Gates (en ESTE worktree, BD activa en 5432)

```
npm ci && npm run lint && npm test && npm run build
```

## Entrega

- Reporte `docs/orca/reports/D2_AUDITOR_REPORT.md`: decisiones (formato A2A
  exacto elegido, con un ejemplo literal de request/response), tabla de los 10
  escenarios con veredicto obtenido, salida LITERAL de gates, `curl` de la
  Agent Card. Hash = `git rev-parse HEAD`.
- Commit único: `feat(auditor): agente auditor A2A con verificaciones y veredicto (D2)`
- Sin push, sin merge, sin PR.
