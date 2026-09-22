# Evaluación de Relevo

Cuatro métricas del plan de la semana 5, más el protocolo para las sesiones
con usuarios. Los números de esta tabla son los de la última corrida en este
worktree. Donde falta la clave o faltan sesiones, dice pendiente.

| Métrica | Qué mide | Comando | Valor de esta corrida |
|---|---|---|---|
| 1. Extracción | Exactitud total base / v1 / v2 (y Grok si hay clave), con IC bootstrap y subgrupos | `npm run eval:extraccion` | n=65. Total base 3.08 %, v1 76.92 % [66.15, 87.69], v2 83.08 % [73.85, 90.77]. Grok pendiente |
| 2. Citas | Recall@3, @5, @8 y MRR de 20 preguntas; juez LLM si hay clave | `npm run eval:citas` | híbrida: recall@3 97.50 %, @5 100 %, @8 100 %, MRR 0.933. Juez pendiente (sin `XAI_API_KEY`) |
| 3. Auditor | Precisión por clase y matriz 3×3 sobre 10 escenarios D2 + 10 nuevos | `npm run eval:auditor` | 20/20. Precisión 100 % en aprobado, observaciones y rechazado |
| 4. Aprobación | Tasa de tarjetas aprobadas sin corrección, simulador aparte de humanos | `npm run eval:aprobaciones` | Simulador 75.83 % (91/120). Humanos: pendiente, 0 filas |

En esta máquina no había `XAI_API_KEY`: Grok queda pendiente en las
métricas 1 y 2. `npm run eval:extraccion` y `npm run eval:citas` llenan
esa columna cuando la clave está en el entorno o en `.env`.

## Cómo reproducir

Hace falta PostgreSQL en `localhost:5432` con el corpus ya indexado. No se
apaga ni se vuelve a sembrar.

- Métrica 1: venv GPU `../relevo-gpu-venv` y adapters en `ml/models/` o, si
  no están, en el worktree hermano `e2-dpo`. Sin `XAI_API_KEY` la columna
  Grok queda pendiente y el comando sale bien.
- Métrica 2: `npm run embed:dev` (puerto 8631) para modo híbrido. Si no
  está, `buscarNorma` usa búsqueda léxica y el informe dice el modo.
- Métrica 3: el script levanta el auditor en un puerto libre. Los 10 casos
  nuevos también están en `tests/evaluacion/auditor_extra.test.ts`.
- Métrica 4: solo lee. Hoy casi todo es `usuario = simulador`.

El protocolo de 15 minutos está en `PROTOCOLO_USUARIOS.md`. La plantilla
para anotar cada sesión es `sesiones/plantilla.csv`.

Los JSON de las corridas quedan en `evaluacion/resultados/` y se versionan:
son chicos y no llevan secretos.
