# Spec C1 — chat-rag (Grok 4.6 en el chat, router, búsqueda híbrida, citas)

Ola C1 de Relevo (semana 3). Lee antes: `docs/ARQUITECTURA.md` (§3.1, §3.2,
§4.1, §4.3), `docs/PLAN_DESARROLLO.md`, `CLAUDE.md`, `README.md`, y el código
existente: `app/api/chat/route.ts`, `components/chat.tsx`, `mcp/*`, `lib/db/*`.

## Objetivo

El chat deja de ser simulado: el asistente es **Grok 4.6 (xAI)** vía
`@ai-sdk/xai`, con router de intención, RAG agéntico con **búsqueda híbrida**
(vectorial bge-m3 + léxica + RRF + re-ranking opcional) y **citas de fuentes
visibles en la UI**. La escritura con tarjeta NO va en esta ola (llega en D1):
si la intención es `orden_escritura`, el asistente lo dice con claridad.

## Archivos que PUEDES tocar (nada más)

- `app/**` (la ruta de chat y una nueva `app/api/salud/route.ts` opcional)
- `components/**`, `lib/**` (incluye `lib/agente/**` nuevo; NO borres
  `lib/tipos.ts`, extiéndelo si hace falta)
- `mcp/consultas.ts` (rama híbrida de `buscar_norma`), `mcp/esquemas.ts` (solo
  agregar campos), `mcp/servidor.ts` (solo si necesitas pasar dependencias)
- `ml/servir.py` (nuevo, servicio embed/re-rank) y `ml/requirements.txt`
  (solo AGREGAR: fastapi, uvicorn, FlagEmbedding ya está)
- `tests/web/**`, `tests/mcp/**` (ajustar/añadir; no borres cobertura)
- `package.json`/`package-lock.json` (solo AGREGAR deps: `@ai-sdk/xai`; y
  scripts nuevos si hacen falta), `.env.example` (descomentar/documentar
  `XAI_API_KEY`, `EMBED_SERVICE_URL`, `RELEVO_MODELO`)
- `docs/orca/reports/C1_CHAT_RAG_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `db/`, `data/`, `ml/` salvo `servir.py` y
`requirements.txt`, `corpus/`, `docker-compose.yml`, `CLAUDE.md`, `docs/*.md`,
`docs/entrega/`, `scripts/gates.mjs`.

## Requisitos

1. **Cliente MCP en proceso** (`lib/agente/mcp.ts`): el backend del chat habla
   con el servidor MCP existente por **protocolo MCP real** usando
   `InMemoryTransport.createLinkedPair()` + `crearServidor(sql)` (singleton por
   proceso, lazy). Las tools del asistente (AI SDK `tool()`) delegan en
   `cliente.callTool(...)`: el contrato MCP es la única superficie de datos.
2. **Asistente** (`app/api/chat/route.ts` + `lib/agente/asistente.ts`):
   - `streamText` con `@ai-sdk/xai`, modelo por env `RELEVO_MODELO`
     (default `grok-4.6`), `XAI_API_KEY` solo de `process.env` (nunca en
     código ni logs). Sin clave → el endpoint responde el stream simulado
     actual con una nota «configura XAI_API_KEY» (el chat no revienta).
   - System prompt en español: Relevo, coordinador de turnos colombiano,
     reglas (citar SIEMPRE en respuestas normativas; no inventar datos de
     nómina: usar tools; escritura aún no disponible), fecha actual inyectada.
   - Tools expuestas al modelo: `listar_empleados`, `consultar_turnos`,
     `consultar_ausencias`, `buscar_norma` (RAG agéntico: el modelo decide),
     `stopWhen: stepCountIs(6)` o equivalente para multi-paso.
3. **Router de intención** (`lib/agente/router.ts`): clasifica el último
   mensaje en `charla | consulta_datos | consulta_norma | orden_escritura`
   con `generateObject` (Zod enum + confianza + razón). El resultado se
   antepone al system prompt (guía, no bloquea) y viaja en la respuesta como
   metadato (`data part` del stream) para mostrarlo en la UI. Inyectable/mock
   en tests.
4. **`buscar_norma` híbrida** (`mcp/consultas.ts`):
   - Vector: embedding de la consulta vía servicio HTTP (`EMBED_SERVICE_URL`,
     default `http://localhost:8631`), `embedding <=> $1` con HNSW, top 30.
   - Léxica: la actual, top 30.
   - Fusión **RRF** (k=60) → top 20 → re-rank vía `/rerank` del servicio si
     responde → top `k` final.
   - **Degradación**: si el servicio embed no responde en 3 s, solo léxica y
     el resultado lleva `modo: "lexica"` (la UI puede ignorarlo); nunca error.
   - La salida agrega `modo` y conserva el contrato existente.
5. **Servicio embed/re-rank** (`ml/servir.py`): FastAPI con `POST /embed`
   `{textos: [..]} → {vectores: [[..]]}` (bge-m3, mismos parámetros que
   `corpus_lib/embeddings.py`, reutilízalo importándolo) y `POST /rerank`
   `{consulta, textos} → {scores}` con `BAAI/bge-reranker-v2-m3` (lazy; si el
   modelo no está descargado, `/rerank` responde 501 y el TS lo trata como
   «sin re-ranker»). `GET /salud`. Script npm `embed:dev` que lo lanza con el
   venv de ML (documenta en el reporte el comando exacto). Arranca en CPU.
6. **UI de citas** (`components/`): las respuestas del asistente muestran un
   panel «Fuentes» cuando `buscar_norma` se usó: fuente, `ref`, título y URL
   (link), numeradas; el system prompt instruye citar como `[1]`, `[2]`
   referenciando ese orden. Muestra también un chip discreto con la intención
   del router. Indicador de tool en curso («consultando norma…»).
7. **Tests** (sin red y sin clave): router con modelo mock; ruta de chat sin
   `XAI_API_KEY` (stream simulado con nota); rama híbrida con embed mockeado
   (función inyectable) contra la BD real: RRF mezcla un hit vectorial y uno
   léxico; degradación a léxica cuando el servicio no responde; el panel de
   fuentes renderiza con un mensaje fixture. Mantén verdes los tests
   existentes (ajusta el de `buscar_norma` si el contrato ganó campos).
8. **Calidad**: español, UTF-8 sin BOM, sin secretos (la clave solo por env),
   TypeScript estricto.

## Gates (en ESTE worktree, uno a la vez, BD activa en localhost:5432)

```
npm ci
npm run lint
npm test
npm run build
```

(la BD del checkout padre ya corre en 5432 con el corpus indexado; no la
apagues ni la re-siembres)

## Entrega

- Reporte `docs/orca/reports/C1_CHAT_RAG_REPORT.md`: decisiones, salida
  LITERAL de los gates, cómo arrancar `ml/servir.py`, y una transcripción de
  humo: con el servicio embed arriba y SIN clave xAI, la llamada directa a la
  tool `buscar_norma` híbrida para «recargo nocturno» (pega los 3 primeros
  resultados con `modo: "hibrida"`). Hash = `git rev-parse HEAD`.
- Commit único: `feat(chat): asistente Grok con router, RAG híbrido y citas (C1)`
- Sin push, sin merge, sin PR.
