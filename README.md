# Relevo

Agente conversacional para coordinar turnos y ausencias en una pyme colombiana
con horarios rotativos. Entiende español coloquial, consulta el Código
Sustantivo del Trabajo con citas, y **solo escribe en la nómina cuando una
persona aprueba una tarjeta**. Lo que muestra la tarjeta es lo que se escribe.
Cada decisión queda como par de preferencia para afinar un extractor propio.

Proyecto final de **SI7016 — Procesamiento del Lenguaje Natural Aplicado**
(Universidad EAFIT, Maestría en Ciencias de Datos y Analítica, 2026-2).
Informe, presentación y guion: [`informe/`](informe/).

**Equipo:** Isabel Jurado Jaramillo · Alejandro Silva Zuluaga · David Botero Londoño

Licencia: [MIT](LICENSE).

## Resultados que ya están medidos

| Resultado | Cifra | De dónde sale |
|---|---|---|
| Exactitud total del extractor, test n = 65 | 3,08 % base → 76,92 % QLoRA v1 → 83,08 % DPO v2 (+6,15 pp). IC 95 % de v2 [73,85 %, 90,77 %]; se solapa con el de v1 | [`docs/orca/reports/E2_DPO_REPORT.md`](docs/orca/reports/E2_DPO_REPORT.md), [`evaluacion/resultados/extraccion.json`](evaluacion/resultados/extraccion.json) |
| Misma tabla contra Grok 4.7 | 98,46 % [95,38 %, 100,00 %]; acción, empleado, turno, justificación y JSON válido en 100 %; fechas (F1) 98,46 %. Los intervalos de v2 y Grok no se solapan: hoy la frontera gana | [`evaluacion/extraccion.md`](evaluacion/extraccion.md), [`evaluacion/resultados/extraccion.json`](evaluacion/resultados/extraccion.json) |
| Nómina sintética, semilla 42 | 40 empleados, 1 837 asignaciones, 30 ausencias, 0 solapes | [`docs/orca/reports/A2_DB_REPORT.md`](docs/orca/reports/A2_DB_REPORT.md) |
| Corpus descargado | 20 documentos | [`docs/orca/reports/A3_CORPUS_REPORT.md`](docs/orca/reports/A3_CORPUS_REPORT.md) |
| Corpus insertado en B2 | 18 documentos, 497 chunks (histórico) | [`docs/orca/reports/B2_INTEGRACION_REPORT.md`](docs/orca/reports/B2_INTEGRACION_REPORT.md) |
| Corpus vigente | 20 documentos, 589 chunks | Commit `a21a6d6` (BOM de Función Pública) |
| Citas, 20 preguntas, modo híbrido | recall@3 97,50 %, @5 100 %, @8 100 %, MRR 0,933. Fidelidad media 0,926 con juez Grok 4.7 (16 de 20 en 1,000; mínimo 0,500 en c02) | [`evaluacion/citas.md`](evaluacion/citas.md), [`evaluacion/resultados/citas.json`](evaluacion/resultados/citas.json), [`docs/orca/reports/F1_EVALUACION_REPORT.md`](docs/orca/reports/F1_EVALUACION_REPORT.md) |
| «Recargo nocturno», híbrido, k = 8 | art. 169, art. 168, art. 161 en 322 ms | [`docs/orca/reports/C1_CHAT_RAG_REPORT.md`](docs/orca/reports/C1_CHAT_RAG_REPORT.md) |
| Auditor | 20/20. Precisión 100 % por clase. Matriz diagonal | [`evaluacion/resultados/auditor.json`](evaluacion/resultados/auditor.json) |
| Aprobación | Simulador 75,83 % (91/120). Humanos: 0 filas | [`evaluacion/resultados/aprobaciones.json`](evaluacion/resultados/aprobaciones.json) |
| Traza | Span `relevo.turno` en Phoenix, status OK | [`docs/orca/reports/E1_OBSERVABILIDAD_REPORT.md`](docs/orca/reports/E1_OBSERVABILIDAD_REPORT.md) |
| Pruebas con usuarios | Pendiente de sesiones. Protocolo en `evaluacion/PROTOCOLO_USUARIOS.md` | [`docs/orca/reports/F1_EVALUACION_REPORT.md`](docs/orca/reports/F1_EVALUACION_REPORT.md) |

El detalle y las advertencias (qué es simulado, qué falta) están en
[`informe/INFORME_FINAL.md`](informe/INFORME_FINAL.md).

## Arquitectura

```mermaid
flowchart LR
    UI["Chat Next.js"] --> AS["Asistente Grok 4.7"]
    AS --> MCP["MCP: lecturas y crear_propuesta"]
    AS --> AUD["Auditor A2A"]
    MCP --> PG["PostgreSQL 17 + pgvector"]
    AUD --> MCP
    AS -.-> EXT["Extractor Qwen3.5-0.8B + QLoRA"]
    PG --> DPO["pares_preferencia"]
    DPO -.-> EXT
```

`ejecutar_propuesta` no es una tool del modelo: la llama el backend cuando la
tarjeta se aprueba o se corrige. Diagramas y contratos:
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Entrega de la semana 2:
[`docs/entrega/S2_arquitectura.html`](docs/entrega/S2_arquitectura.html).
Informe y presentación de la semana 5:
[`docs/entrega/S5_informe.html`](docs/entrega/S5_informe.html),
[`docs/entrega/S5_presentacion.html`](docs/entrega/S5_presentacion.html).

## Cómo correrlo de cero

**Requisitos:** Node 24 o superior, Python 3.11 (el venv de `npm test` lo
necesita: `ml/` importa `datetime.UTC`), Docker.

La base de desarrollo de este equipo ya puede estar en el puerto 5432. Si lo
está, no la apaguen ni la re-siembren: usen ese `localhost:5432`. Los pasos 2,
5, 6 y 7 son para una base vacía.

1. Clona el repositorio y entra en la carpeta.
2. Copia [`.env.example`](.env.example) a `.env`. Rellena `XAI_API_KEY` si vas
   a usar Grok. Sin esa variable el chat responde el stream simulado y lo dice.
   Los valores de `DATABASE_URL` del ejemplo son credenciales locales de
   desarrollo, no un secreto de producción. No subas `.env`.
3. PostgreSQL + pgvector, solo si el puerto 5432 está libre:
   `docker compose up -d db`
4. Phoenix (no depende de la base; se puede levantar aparte):
   `docker compose up -d phoenix`
   Interfaz en `http://localhost:6006`. El backend exporta OTLP **protobuf** a
   `http://localhost:6006/v1/traces`. Esta imagen de Phoenix responde 415 al
   OTLP en JSON.
5. Venv de gates, Python 3.11:
   `py -3.11 -m venv .venv`
   - Windows: `.venv\Scripts\activate` y `pip install -r requirements-dev.txt`
   - macOS/Linux: `source .venv/bin/activate` y el mismo `pip`
6. Migraciones: `python db/migrate.py`
7. Nómina sintética (Faker `es_CO`, semilla 42) y seed:
   `python data/generar_dataset.py`
   `python db/seed.py`
   Si las tablas ya tienen filas, `python db/seed.py` se niega. `--reseed`
   reemplaza la nómina y no toca el corpus. No lo uses sobre una base
   compartida.
8. Dependencias Node: `npm ci`
9. Venv de ML **fuera del clone** (torch dentro del repo hace que ESLint y
   `next build` recorran sus archivos). Desde la raíz:

   ```text
   py -3.11 -m venv ../relevo-ml-venv
   ..\relevo-ml-venv\Scripts\pip install -r ml/requirements.txt
   ..\relevo-ml-venv\Scripts\python ml/indexar.py --solo-descarga
   ..\relevo-ml-venv\Scripts\python ml/indexar.py --desde-cache
   ```

   En macOS/Linux, `../relevo-ml-venv/bin/pip` y `bin/python`.
   `--desde-cache` **sin** `--limit`: un límite grabaría hashes con chunks
   parciales. Si `corpus/raw/` ya existe, puedes omitir `--solo-descarga`.
   `corpus/raw/` no se versiona.
10. Servicio de embeddings (otra terminal, mismo venv de ML):
    `npm run embed:dev`
    Salud: `GET http://127.0.0.1:8631/salud` → `{"ok":true}`.
    La primera carga de bge-m3 en CPU supera el tope de 3 s y esa consulta
    degrada a léxico. `POST /rerank` responde 501 si
    `BAAI/bge-reranker-v2-m3` no está en la caché de Hugging Face; la búsqueda
    sigue con los scores de RRF.
11. Auditor A2A (otra terminal): `npm run auditor:dev`
    Escucha en `AUDITOR_PORT` (8641). Tarjeta:
    `GET http://127.0.0.1:8641/.well-known/agent.json`.
12. Chat: `npm run dev` y abre `http://localhost:3000`.
    El selector trae Coordinadora de enfermería, Jefe de vigilancia y Gerencia.
    El servidor MCP por stdio, si lo quieres aparte del chat, es `npm run mcp`.

El extractor afinado como servicio HTTP está en `ml/servir_extractor.py`.
`npm run extractor:dev` lo levanta en `127.0.0.1` y en el puerto 8642, y
prefiere el adaptador v2 si `ml/models/extractor-v2/adapter_config.json`
existe (reporte E2). Con `EXTRACTOR_URL` vacío, la extracción la hace Grok.
Si el servicio falla, también cae a Grok. El humo de E2, «ponle el de la
noche a Ana el puente» con fecha 2026-09-21, devolvió Ana Mery Montoya
Patiño, turno N, fecha 2026-10-12 y acción `asignar` (69 s en frío, 11 s
en caliente).

Variables documentadas en [`.env.example`](.env.example): `DATABASE_URL`,
`PGPORT`, `XAI_API_KEY`, `RELEVO_MODELO`, `EMBED_SERVICE_URL`, `AUDITOR_URL`,
`AUDITOR_PORT`, `AUDITOR_TIMEOUT_MS`, `EXTRACTOR_URL`,
`PHOENIX_COLLECTOR_ENDPOINT`, `OTEL_SERVICE_NAME`.

## Cómo reproducir cada evaluación

Con la base activa y, para el extractor, el venv de GPU que usó C3
(`../relevo-gpu-venv`: torch con CUDA, `peft`, `trl`, `bitsandbytes`). Los
pesos `ml/models/` y las corridas `ml/runs/` no se versionan.

| Qué | Comando | Qué falta |
|---|---|---|
| Gates | `npm run lint`, `npm test`, `npm run build` | — |
| Extracción base, v1 y v2 | `npm run eval:extraccion` (`evaluacion/evaluar_extraccion.py`) y `ml/comparar_versiones.py` | — (la columna Grok 4.7 requiere `XAI_API_KEY`) |
| Citas | `npm run eval:citas` (`evaluacion/evaluar_citas.ts`) | — (el juez Grok 4.7 requiere `XAI_API_KEY`) |
| Auditor | `npm run eval:auditor` (10 de D2 y 10 trampas nuevas, matriz 3×3). `npm test` sigue incluyendo los 10 de `tests/auditor/escenarios.test.ts` | — |
| Aprobaciones | `npm run eval:aprobaciones` | Tasa humana: 0 filas hasta las sesiones |
| Usuarios | Protocolo: [`evaluacion/PROTOCOLO_USUARIOS.md`](evaluacion/PROTOCOLO_USUARIOS.md). Plantilla: `evaluacion/sesiones/plantilla.csv` | Las sesiones |

Entrenar v1 de nuevo (misma línea que C3, 4 635 s en la 4060 de ese reporte):

```text
..\relevo-gpu-venv\Scripts\python.exe ml\entrenar_lora.py --epocas 3 --lr 0.0002 --r 16 --batch 1 --grad-acum 8 --salida ml\models\extractor-v1
```

## Estructura

| Ruta | Qué hay |
|---|---|
| `app/`, `components/`, `lib/` | Chat Next.js 15, agente, guardrails, memoria, cliente A2A |
| `mcp/` | Tools MCP |
| `auditor/` | Servicio A2A y reglas (44 h, domingos, solapes) |
| `db/` | Migraciones SQL, runner y seed |
| `data/` | Nómina sintética y órdenes (`train` / `val` / `test`) |
| `ml/` | Indexación bge-m3, `servir.py`, extractor QLoRA, `ml/dpo/`, `servir_extractor.py` |
| `evaluacion/` | Cuatro métricas, protocolo de usuarios y `resultados/` |
| `corpus/` | `fuentes.json` (`raw/` no se versiona) |
| `informe/` | Informe final, presentación, guion de demo |
| `docs/` | Arquitectura, plan, fuentes del curso, specs y reportes |
| `docker-compose.yml` | PostgreSQL 17 + pgvector, y Phoenix |

## Estado por semana

| Semana | Qué quedó |
|---|---|
| S1 | Propuesta: `docs/fuentes/Propuesta_Relevo_NLP_v2.docx` |
| S2 | Arquitectura, esqueleto, esquema, corpus, MCP de lectura, gates |
| S3 | Grok, RAG híbrido con citas, QLoRA v1 (3,08 % → 76,92 %) |
| S4 | Tarjeta, auditor A2A, trazas en Phoenix, perfiles y guardrails |
| S5 | DPO v2 (83,08 %, intervalos solapados con v1), Grok 4.7 (98,46 %, no solapa con v2), juez de citas (0,926), suite en `evaluacion/`, este informe, la presentación y el guion. Las sesiones con personas y el despliegue siguen pendientes |

Plan: [`docs/PLAN_DESARROLLO.md`](docs/PLAN_DESARROLLO.md). Tope de entrega del curso: 30 de septiembre de 2026.

## Demo

[`informe/GUION_DEMO.md`](informe/GUION_DEMO.md). Ocho minutos, con checklist de diez puntos y un plan B si xAI no responde.

## Reglas duras

1. **Datos sintéticos.** Empleados, turnos, ausencias y órdenes son ficticios (Faker `es_CO`, semilla 42). Nada de datos reales ni de terceros.
2. **Escribir exige aprobación.** Ninguna ruta escribe en `empleados`, `asignaciones` o `ausencias` sin una propuesta aprobada en una tarjeta.
3. **Secretos solo en `.env`.** Nunca en el repo, en logs, en tests ni en reportes.
