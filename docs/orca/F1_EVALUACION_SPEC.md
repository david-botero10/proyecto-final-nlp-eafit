# Spec F1 — evaluación (suite completa de evals, juez de citas, protocolo con usuarios)

Ola F1 de Relevo (semana 5). Lee antes: `docs/ARQUITECTURA.md` §8,
`docs/PLAN_DESARROLLO.md` (las 4 métricas y E1), `CLAUDE.md`, y los reportes
de C1, C3, D1, D2, E1, E2 en `docs/orca/reports/` (cada uno ya trae una
evaluación parcial: humo híbrido, tabla base/v1/v2, 10 escenarios del
auditor, evidencia Phoenix). Código: `ml/extractor/*`, `ml/dpo/*`,
`ml/comparar_versiones.py`, `tests/auditor/escenarios.test.ts`,
`mcp/consultas.ts` (buscar_norma), `lib/agente/*`.

## Objetivo

Consolidar la **evaluación del proyecto** en un solo lugar reproducible
(`evaluacion/`), con las cuatro métricas del plan calculadas de verdad y un
protocolo listo para las pruebas con usuarios. Es la evidencia del criterio
«Evaluación y validación» y alimenta el informe (F2).

## Archivos que PUEDES tocar (nada más)

- `evaluacion/**` (nuevo: scripts, datasets dorados, resultados en
  `evaluacion/resultados/*.md|json` — estos SÍ se comitean, son pequeños)
- `ml/evals/**` (nuevo, si prefieres Python para el juez de citas)
- `package.json` (solo scripts `eval:*`), `ml/requirements-dev.txt`?? NO
  existe: usa `requirements-dev.txt` raíz solo para AGREGAR una dependencia
  si es imprescindible
- `tests/evaluacion/**`, `ml/tests/test_evals*.py`
- `docs/orca/reports/F1_EVALUACION_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `app/`, `components/`, `lib/`, `mcp/`,
`auditor/`, `db/`, `data/`, `ml/extractor`, `ml/dpo`, `corpus/`, `docs/*.md`.
F2 corre en paralelo sobre `docs/` e `informe/`.

## Requisitos

1. **Métrica 1 — exactitud de extracción** (`evaluacion/extraccion.md`):
   reutiliza `ml/comparar_versiones.py` (de E2). Corre base | v1 | v2 y, si
   hay `XAI_API_KEY` en el entorno, también **Grok** (`--proveedor xai`).
   Si no hay clave, deja la columna «pendiente: requiere XAI_API_KEY» y un
   script `npm run eval:extraccion` que la complete cuando exista. Incluye
   intervalos bootstrap y subgrupos (fechas relativas vs. absolutas; acción).
   Tabla + 3 párrafos de análisis honesto (dónde gana cada uno y por qué).
2. **Métrica 2 — fidelidad de citas** (`evaluacion/citas_doradas.jsonl` +
   `evaluacion/citas.md`): 20 preguntas normativas doradas en español
   coloquial (recargo nocturno, dominical, horas extra, jornada máxima y su
   reforma, descanso, vacaciones, licencia de maternidad, contrato, etc.)
   con el/los artículos esperados (`refs_esperadas: ["art. 168", ...]`).
   Script `evaluacion/evaluar_citas.ts` que, contra la BD del 5432, llama a
   `buscarNorma` (híbrida si el servicio embed está arriba —`npm run
   embed:dev`—, si no léxica; registra el `modo`) y mide **recall@k** de los
   artículos esperados (k=3,5,8) y MRR. Además, si hay `XAI_API_KEY`, un
   **juez LLM**: genera la respuesta del asistente con las citas y pide a
   Grok (prompt de juez, salida estructurada) evaluar si cada afirmación
   está soportada por los chunks citados (fidelidad 0–1). Sin clave, solo
   recall/MRR y la columna del juez queda pendiente con su script listo.
3. **Métrica 3 — precisión del auditor** (`evaluacion/auditor.md`): extrae
   la tabla de los 10 escenarios de D2 desde una corrida real de
   `tests/auditor/escenarios.test.ts` (o un script que reutilice sus
   fixtures) y agrega **10 escenarios nuevos** (más trampas: festivo
   trasladado, ausencia que cruza dos semanas, noche que cruza medianoche
   al domingo, empleado inactivo, etc.) en `tests/evaluacion/auditor_extra.test.ts`.
   Reporta precisión por clase (aprobado/observaciones/rechazado) y matriz
   de confusión 3×3.
4. **Métrica 4 — tasa de aprobación humana y regresión entre versiones**
   (`evaluacion/aprobaciones.md`): script SQL/TS que lee `propuestas`,
   `aprobaciones` y `pares_preferencia` y reporta: propuestas por estado,
   tasa de aprobación sin corrección, distribución de `origen` de los pares,
   separando `usuario='simulador'` de humanos. Hoy habrá sobre todo
   simuladas: dilo. Deja la consulta lista para re-correrla tras las sesiones
   con usuarios (`npm run eval:aprobaciones`).
5. **Protocolo de pruebas con usuarios** (`evaluacion/PROTOCOLO_USUARIOS.md`):
   guion de 15 minutos por sesión con 8 tareas (2 consultas de datos, 3
   normativas, 3 órdenes de escritura con al menos una que el auditor deba
   observar/rechazar), qué observar, cuestionario post-tarea de 6 preguntas
   (Likert 1–5: claridad, confianza en las citas, utilidad de la tarjeta,
   ¿aprobaría sin revisar?, esfuerzo, intención de uso) y una plantilla CSV
   `evaluacion/sesiones/plantilla.csv` para registrar cada sesión. Explica
   cómo correr la app completa para la sesión (compose db + phoenix, embed,
   auditor, extractor, `npm run dev`).
6. **Consolidado** (`evaluacion/README.md`): qué mide cada métrica, cómo
   reproducir cada una con un comando, y una tabla resumen con los valores
   obtenidos hoy (y «pendiente» donde falte clave o usuarios).
7. **Tests**: parser de `citas_doradas.jsonl` válido y sin refs vacías;
   recall@k y MRR con fixtures calculados a mano; matriz de confusión con
   fixtures; los 10 escenarios extra del auditor pasan (BD real).
8. **Calidad**: español, UTF-8 sin BOM, sin secretos (la clave solo por env).

## Gates (en ESTE worktree, BD activa en 5432)

```
npm ci && npm run lint && npm test && npm run build
.venv/Scripts/python -m ruff check ml data evaluacion   (si hay Python)
```

## Entrega

- Reporte `docs/orca/reports/F1_EVALUACION_REPORT.md`: tabla resumen de las 4
  métricas con valores reales, qué quedó pendiente y por qué, salida LITERAL
  de gates. Hash = `git rev-parse HEAD`.
- Commit único: `feat(evaluacion): suite de evals, juez de citas y protocolo con usuarios (F1)`
- Sin push, sin merge, sin PR.
