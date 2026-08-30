# Relevo — Plan de desarrollo S2–S5

Olas de trabajo por semana del curso. Cada ola tiene una spec en `docs/orca/`,
se ejecuta en un worktree aislado con archivos disjuntos, y se fusiona a `main`
solo con gates verdes (`npm run lint`, `npm test`, `npm run build`) y auditoría
del orquestador. Entrega final máxima: **30 de septiembre de 2026**.

## Semana 2 — Arquitectura + esqueleto (entrega: diseño de arquitectura)

### Ola 0 — Documentación y specs (orquestador)

`docs/ARQUITECTURA.md`, este plan, `CLAUDE.md`, `README.md`, specs de la ola A.

**Aceptación:** los documentos cubren todos los puntos pedidos por el curso para
la semana 2 (componentes, flujos, integración con herramientas, tecnologías);
exportables a PDF; commit en `main`.

### Ola A — Esqueleto base (3 workers en paralelo, archivos disjuntos)

| Ola | Alcance | Criterios de aceptación |
|---|---|---|
| **A1 web-skeleton** | Next.js 15 + AI SDK: página de chat vacía (sin modelo), layout Relevo en español, ESLint + Vitest configurados | `npm run lint/test/build` verdes; la página renderiza y el endpoint `/api/chat` responde un stream simulado; sin dependencias de BD |
| **A2 db-schema** | `docker-compose.yml` (pgvector), migraciones SQL del esquema completo (§6 de ARQUITECTURA), runner `db/migrate.py`, generador `data/generar_dataset.py` y seed | Migraciones aplican de cero en BD limpia; seed determinista (semilla 42) sin solapes; pytest verde contra la BD del compose; roles lector/escritor creados |
| **A3 corpus-indexer** | `ml/indexar.py`: descarga fuentes públicas → chunking estructural → bge-m3 → upsert pgvector; `corpus/fuentes.json` | Chunker probado con fixtures (pytest sin BD); `--limit` y caché local funcionan; descarga real de al menos el CST verificada; ruff verde |

### Ola B — Integración (2 workers, tras merge de A)

| Ola | Alcance | Criterios de aceptación |
|---|---|---|
| **B1 mcp-server** | Servidor MCP TypeScript con tools de lectura: `listar_empleados`, `consultar_turnos`, `consultar_ausencias`, `buscar_norma` (léxica) | Tools responden con datos reales del seed; contratos Zod idénticos a §4.1; tests de integración verdes |
| **B2 integracion** | Gates unificados TS+Python, `.env.example`, `README.md` completo («cómo correrlo» de cero), corrida end-to-end de indexación | Un compañero puede clonar y correr todo siguiendo el README; los tres gates raíz cubren ambos lenguajes |

**Eval de la semana:** verificación manual de la búsqueda léxica (`buscar_norma`
responde artículos correctos para 10 consultas de prueba documentadas).

## Semana 3 — Prototipo funcional inicial

| Ola | Alcance | Criterios de aceptación | Eval que introduce |
|---|---|---|---|
| **C1 chat-rag** | Conexión Grok 4.6 (`@ai-sdk/xai`), router de intención, `buscar_norma` híbrida (servicio embed bge-m3 + RRF + re-ranker), citas en la UI | Conversación real con herramientas; toda respuesta normativa muestra citas verificables | Fidelidad de citas (juez LLM sobre 20 preguntas normativas doradas) |
| **C2 escritura-tarjeta** | `crear_propuesta` + tarjeta de aprobación en UI + `ejecutar_propuesta` transaccional + registro de `aprobaciones` y `pares_preferencia` | Imposible escribir sin tarjeta aprobada (test de invariante); la tarjeta muestra exactamente lo que se escribe | Tasa de éxito del camino completo en 15 órdenes de prueba |
| **C3 lora-v1** | Dataset de órdenes coloquiales (MASSIVE es-ES + sintético propio validado a mano), QLoRA v1 sobre Qwen3.5, harness de evaluación de extracción | ≥300 órdenes sintéticas validadas; LoRA v1 entrenado y evaluado; harness reproducible | Exactitud de extracción por campo: Qwen3.5-LoRA v1 vs. Grok 4.6 (mismo test set) |

## Semana 4 — Prototipo funcional final

| Ola | Alcance | Criterios de aceptación | Eval que introduce |
|---|---|---|---|
| **D1 auditor-a2a** | Auditor como servicio A2A (Agent Card, JSON-RPC), verificaciones deterministas + normativas, veredicto en la tarjeta | Toda propuesta pasa por el auditor; veredictos correctos en 10 escenarios con trampa (solapes, domingo, empleado inexistente) | Precisión del auditor sobre escenarios con trampa |
| **D2 ciclo-dpo** | Exportación de `pares_preferencia` → DPO incremental sobre LoRA v1 → v2; medición antes/después | Ciclo corre end-to-end con los pares reales recogidos; v2 no regresa en el eval set congelado | Delta de exactitud v1→v2 con intervalos |
| **D3 observabilidad** | OTel en backend/MCP/auditor → Phoenix; guardrails de runtime; memoria de conversación y perfil de usuario | Cada conversación trazada; dashboard de regresiones entre versiones; perfil condiciona respuestas | Comparación de versiones en Phoenix |

## Semana 5 — Evaluación, informe y demo

| Ola | Alcance | Criterios de aceptación |
|---|---|---|
| **E1 evaluacion** | Pruebas con usuarios (equipo + invitados) sobre guion de escenarios; corrida completa de la suite de evals; análisis de resultados | ≥5 sesiones de usuario registradas; métricas finales de las 4 evals con análisis |
| **E2 entrega** | Informe técnico final, presentación, demo grabada, despliegue (Vercel + HF Spaces), limpieza del repo | Informe cubre desarrollo, decisiones, evaluación y mejoras; demo reproducible |

## Las cuatro métricas de evaluación del proyecto

1. **Exactitud de extracción** (por campo: empleado, fechas, turno,
   justificación) — Qwen3.5 afinado vs. Grok 4.6, mismo test set congelado.
   Responde la pregunta prospectiva del proyecto.
2. **Fidelidad de citas** — juez LLM verifica que cada afirmación normativa esté
   soportada por los chunks citados.
3. **Tasa de aprobación humana** — proporción de tarjetas aprobadas sin
   corrección; su evolución mide si el sistema aprende.
4. **Regresiones entre versiones** — el eval set congelado corre contra cada
   versión del extractor (base → LoRA v1 → DPO v2) en Phoenix.

## Reglas operativas de todas las olas

- Workers Pi (Grok 4.6, thinking xhigh, gentle-ai) en worktrees hijos; spec
  comiteada en `main` antes de lanzar; máximo 3 en paralelo, archivos disjuntos.
- Reporte por ola en `docs/orca/reports/<OLA>_REPORT.md` con gates literales.
- Merge a `main` únicamente por el orquestador tras auditoría línea a línea.
- Datos sintéticos, secretos solo en `.env`, UTF-8 sin BOM, español en UI y docs.
