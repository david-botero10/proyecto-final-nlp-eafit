# Evaluación de Relevo

Cuatro métricas del plan de la semana 5, más el protocolo para las sesiones
con usuarios. Los números de esta tabla son los de la última corrida en este
worktree. Donde faltan sesiones con personas, dice pendiente.

| Métrica | Qué mide | Comando | Valor de esta corrida |
|---|---|---|---|
| 1. Extracción | Exactitud total base / v1 / v2 y Grok 4.7, con IC bootstrap y subgrupos | `npm run eval:extraccion` | n=65. Total base 3.08 %, v1 76.92 % [66.15, 87.69], v2 83.08 % [73.85, 90.77], Grok 4.7 98.46 % [95.38, 100.00] (no solapa con v2; fechas F1 98.46 %, el resto de campos 100 %) |
| 2. Citas | Recall@3, @5, @8 y MRR de 20 preguntas; fidelidad con juez LLM (Grok 4.7) | `npm run eval:citas` | híbrida: recall@3 97.50 %, @5 100 %, @8 100 %, MRR 0.933. Fidelidad media 0.926 con juez Grok 4.7 (16 de 20 en 1.000; mínimo 0.500 en c02) |
| 3. Auditor | Precisión por clase y matriz 3×3 sobre 10 escenarios D2 + 10 nuevos | `npm run eval:auditor` | 20/20. Precisión 100 % en aprobado, observaciones y rechazado |
| 4. Aprobación | Tasa de tarjetas aprobadas sin corrección, simulador aparte de humanos | `npm run eval:aprobaciones` | Simulador 75.83 % (91/120). Humanos: pendiente, 0 filas |

Grok 4.7 (modelo de frontera desde el commit `2b15c75`) corrió en las
métricas 1 y 2 con `XAI_API_KEY` en el entorno (commits `82cc2c1` y
`e5385fe`). Sin la clave, `npm run eval:extraccion` y `npm run eval:citas`
omiten la columna Grok y el juez. Fuentes: `extraccion.md`, `citas.md` y los
JSON de `resultados/`. El juez de citas reintenta hasta tres veces por
pregunta.

## Cómo reproducir

Hace falta PostgreSQL en `localhost:5432` con el corpus ya indexado. No se
apaga ni se vuelve a sembrar.

- Métrica 1: venv GPU `../relevo-gpu-venv` y adapters en `ml/models/` o, si
  no están, en el worktree hermano `e2-dpo`. Sin `XAI_API_KEY` la columna
  Grok se omite y el comando sale bien.
- Métrica 2: `npm run embed:dev` (puerto 8631) para modo híbrido. Si no
  está, `buscarNorma` usa búsqueda léxica y el informe dice el modo.
- Métrica 3: el script levanta el auditor en un puerto libre. Los 10 casos
  nuevos también están en `tests/evaluacion/auditor_extra.test.ts`.
- Métrica 4: solo lee. Hoy casi todo es `usuario = simulador`.

El protocolo de 15 minutos está en `PROTOCOLO_USUARIOS.md`. La plantilla
para anotar cada sesión es `sesiones/plantilla.csv`.

Los JSON de las corridas quedan en `evaluacion/resultados/` y se versionan:
son chicos y no llevan secretos.
