# Spec D1 — tarjeta (escritura con aprobación humana: propuesta → tarjeta → ejecución → par DPO)

Ola D1 de Relevo (semana 4). Lee antes: `docs/ARQUITECTURA.md` (§3.3 flujo
completo, §4.1 tools `crear_propuesta`/`ejecutar_propuesta`, §6 tablas
`propuestas`/`aprobaciones`/`pares_preferencia`), `CLAUDE.md`, y el código de
C1: `lib/agente/*`, `mcp/*`, `components/*`, `lib/tipos.ts`. Lee también
`ml/extractor/` (C3) para reutilizar el **contrato** de extracción
(`{empleado, turno, fechas[], justificacion, accion}`) — no su código Python.

## Objetivo

El camino de escritura completo, cumpliendo la regla dura del proyecto: **el
asistente nunca escribe; propone**. Una orden coloquial produce una propuesta
persistida (`estado=pendiente`), la UI la muestra como **tarjeta** con las
acciones exactas, y solo la decisión humana (aprobar / corregir / rechazar)
dispara `ejecutar_propuesta` desde el backend, en transacción, registrando
`aprobaciones` y el **par de preferencia** para DPO.

## Archivos que PUEDES tocar (nada más)

- `mcp/consultas.ts`, `mcp/esquemas.ts`, `mcp/servidor.ts` (agregar tools),
  `mcp/escrituras.ts` (nuevo)
- `lib/agente/**` (asistente, prompt, tools; `lib/agente/extraccion.ts` nuevo)
- `lib/tipos.ts` (extender), `lib/db/**`
- `app/api/chat/route.ts`, `app/api/propuestas/**` (nuevo: decisión humana)
- `components/**` (tarjeta nueva `components/tarjeta-propuesta.tsx`)
- `tests/mcp/**`, `tests/web/**`
- `.env.example` (documentar `EXTRACTOR_URL` opcional)
- `docs/orca/reports/D1_TARJETA_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `db/migrations/*` existentes (si necesitas
columnas nuevas, crea `db/migrations/0006_*.sql` y dilo en el reporte),
`data/`, `ml/`, `corpus/`, `docker-compose.yml`, `docs/*.md`, `scripts/`.
Otra ola (D2 auditor) corre en paralelo: NO crees nada bajo `auditor/` ni
toques `lib/a2a/`.

## Requisitos

1. **Extracción** (`lib/agente/extraccion.ts`): dado `orden_texto` y la fecha
   de hoy, produce `Extraccion` con `generateObject` sobre el modelo de chat
   (Grok) usando un prompt que resuelve fechas relativas colombianas. Si
   `EXTRACTOR_URL` está definido (servicio del extractor afinado, lo expone
   la ola E2), llama primero a ese `POST /extraer` y cae a Grok si falla.
   Registra en la propuesta `extraccion.proveedor: "xai" | "lora"`.
2. **Tool `crear_propuesta`** (MCP, escritura de propuesta, NO de nómina):
   entrada `{orden_texto, extraccion, acciones[]}`; valida contra la base
   (empleado existe y activo → `empleado_id`; fechas dentro de 92 días;
   detecta solapes con asignaciones y ausencias aprobadas y los adjunta en
   `contexto`); inserta en `propuestas` con `estado='pendiente'`; devuelve
   `{propuesta_id, estado, acciones, contexto}`. Anotación `readOnlyHint:false`,
   `destructiveHint:false`. Las `acciones[]` son las de `lib/tipos.ts`:
   `asignar_turno {empleado_id, turno, fecha}`, `registrar_ausencia
   {empleado_id, tipo, fecha_inicio, fecha_fin, motivo}`, `cancelar_turno
   {empleado_id, fecha}` (extiende `TIPO_ACCION`).
3. **`ejecutar_propuesta`** (`mcp/escrituras.ts`, **NO registrada como tool
   MCP para el modelo**; función del backend): `{propuesta_id, decision:
   "aprobar"|"corregir"|"rechazar", correccion?: acciones[]}`. En UNA
   transacción con el rol `relevo_escritor` (`SET LOCAL ROLE`): verifica
   `estado='pendiente'`; si `aprobar`, escribe exactamente `propuestas.acciones`
   congeladas; si `corregir`, escribe `correccion`; si `rechazar`, no toca
   nómina. Escribe filas con `origen='tarjeta'` y `propuesta_id`. Inserta
   `aprobaciones` y el par en `pares_preferencia` (`elegida` = extracción
   aprobada o corregida; `rechazada` = extracción original si hubo
   corrección/rechazo; `origen` según decisión). Actualiza `propuestas.estado`
   y `decidido_en`. Devuelve resumen de filas escritas. Doble decisión sobre
   la misma propuesta → error claro, sin escribir.
4. **Asistente**: cuando la intención es `orden_escritura`, el flujo es
   extraer → validar con lecturas → `crear_propuesta` → emitir un data part
   `data-propuesta` con la propuesta completa (para la tarjeta) → responder en
   texto «te propongo…, revisa la tarjeta». El system prompt deja de decir
   «escritura no disponible». **Invariante en código**: `ejecutar_propuesta`
   no está en `herramientas()`; añade un test que lo afirme (lista de tools
   expuestas no la contiene).
5. **Endpoint de decisión** `POST /api/propuestas/[id]/decision` con body Zod
   `{decision, correccion?, usuario}` → llama `ejecutar_propuesta` y devuelve
   el resumen. `GET /api/propuestas/[id]` devuelve la propuesta (para
   refrescar la tarjeta).
6. **Tarjeta** (`components/tarjeta-propuesta.tsx`): muestra orden original,
   extracción interpretada, tabla de acciones exactas (empleado, fecha,
   turno/tipo), avisos de `contexto` (solapes) y, si existe,
   `veredicto_auditor` (lo llena D2; renderiza «sin auditar» si es null).
   Botones **Aprobar / Corregir / Rechazar**; «Corregir» abre edición inline
   de las acciones (cambiar turno/fecha/quitar fila) y envía `correccion`.
   Tras decidir, muestra el resumen escrito y bloquea los botones. Estados de
   carga y error en español.
7. **Tests** (sin red; router/extracción con mocks; BD real del 5432):
   - `crear_propuesta` valida empleado inexistente (error), detecta solape
     con una asignación del seed y lo reporta en `contexto`, y persiste con
     `estado='pendiente'`.
   - `ejecutar_propuesta`: aprobar escribe exactamente las acciones y crea
     `aprobaciones` + `pares_preferencia(origen='aprobacion')`; corregir
     escribe la corrección y guarda `rechazada`=original; rechazar no toca
     nómina y guarda el par de rechazo; segunda decisión → error; todo con
     limpieza (borra lo que insertó, incluidas filas de nómina con
     `origen='tarjeta'`).
   - Invariante: `ejecutar_propuesta` no está entre las tools del modelo.
   - Tarjeta: renderiza acciones y al hacer clic en Aprobar llama al endpoint
     (fetch mock) y muestra el resumen.
   - Endpoint: body inválido → 400; propuesta inexistente → 404.
8. **Calidad**: español, UTF-8 sin BOM, sin secretos, TypeScript estricto.

## Gates (en ESTE worktree, BD activa en 5432)

```
npm ci && npm run lint && npm test && npm run build
```

## Entrega

- Reporte `docs/orca/reports/D1_TARJETA_REPORT.md`: decisiones, salida
  LITERAL de gates, y una corrida manual documentada del camino completo por
  API (crear propuesta con `curl`/script → aprobar → SELECT que muestre la
  asignación con `origen='tarjeta'` y el par de preferencia → limpieza).
  Hash = `git rev-parse HEAD`.
- Commit único: `feat(tarjeta): propuesta, tarjeta de aprobación y ejecución gobernada (D1)`
- Sin push, sin merge, sin PR.
