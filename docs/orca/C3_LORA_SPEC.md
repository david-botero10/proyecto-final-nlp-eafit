# Spec C3 — lora-v1 (dataset de órdenes coloquiales + QLoRA + harness de evaluación)

Ola C3 de Relevo (semana 3). Lee antes: `docs/ARQUITECTURA.md` (§4.3 extractor,
§8 evals), `docs/PLAN_DESARROLLO.md` (C3 y las 4 métricas), `CLAUDE.md`,
`lib/tipos.ts` (contrato `Extraccion`), `data/generar_dataset.py` (empleados
del seed: los nombres de las órdenes deben existir en la nómina sintética).

## Objetivo

El extractor propio: dataset de órdenes en español coloquial colombiano →
JSON `{empleado, turno, fechas[], justificacion}`, fine-tuning **LoRA sobre un
Qwen3.5 pequeño** en la GPU local (RTX 4060 Laptop, 8 GB), y un harness de
evaluación reproducible que compara base vs. LoRA v1 (y vs. Grok por API
cuando haya clave). Este harness es la métrica 1 del proyecto y el punto de
partida del ciclo DPO (S4).

## Archivos que PUEDES tocar (nada más)

- `data/ordenes/**` (nuevo: generador, dataset JSONL comiteado, VALIDACION.md)
- `ml/extractor/**` (nuevo: prompts, carga del modelo, entrenamiento, eval)
- `ml/entrenar_lora.py`, `ml/evaluar_extraccion.py` (CLIs delgados sobre
  `ml/extractor/`)
- `ml/requirements-gpu.txt` (nuevo: torch CUDA, transformers, peft, trl,
  datasets, bitsandbytes; NO toques `ml/requirements.txt`)
- `ml/pyproject.toml` (solo agregar rutas de tests/ruff si hace falta)
- `ml/tests/**` (solo AGREGAR archivos `test_ordenes*.py`, `test_extractor*.py`)
- `docs/orca/reports/C3_LORA_REPORT.md`

PROHIBIDO tocar: `.gitignore` (ya ignora `ml/models/`, `ml/checkpoints/`,
`ml/runs/`, `*.safetensors`), todo lo TS, `db/`, `data/*.py` existente,
`corpus/`, `ml/corpus_lib/`, `ml/servir.py` si existe, `ml/indexar.py`,
`docs/*.md`. Otra ola (C1) corre en paralelo sobre archivos disjuntos.

## Requisitos

1. **Generador** (`data/ordenes/generar_ordenes.py`, semilla 42, determinista):
   - Órdenes de las 3 acciones que Relevo entiende: asignar turno, registrar
     ausencia, cambiar/quitar turno. Salida JSONL con
     `{orden, fecha_referencia, esperado: {empleado, turno: "M"|"T"|"N"|null,
     fechas: ["YYYY-MM-DD", ...], justificacion: str|null, accion:
     "asignar"|"ausencia"|"quitar"}}`.
   - **Coloquial colombiano**: plantillas variadas con modismos y fechas
     relativas resueltas contra `fecha_referencia`: «la otra semana», «el
     puente» (festivos colombianos 2026 en un módulo de datos), «pasado
     mañana», «el finde», «de hoy en ocho», «la primera semana de octubre»,
     apodos/diminutivos de nombres del seed («Ana» por «Ana María»),
     «el de la mañana / el turno de la noche / que doble», justificaciones
     («está incapacitada», «se le murió un familiar», «pidió permiso»).
   - ≥ 450 ejemplos: ~350 train / ~50 val / ~60 test (split por hash del
     texto, sin fugas de plantilla exacta entre train y test: los moldes de
     test son variantes no vistas). Además ~40 negativos (charla/consulta que
     NO es orden) con `esperado: null`.
   - `data/ordenes/{train,val,test}.jsonl` se COMITEAN (texto pequeño).
   - `data/ordenes/VALIDACION.md`: cómo se validó (asserts de fechas
     resueltas contra calendario, muestreo manual de 30 ejemplos por el
     worker con veredicto por ejemplo) — honesto: di qué fue automático y qué
     fue revisión tuya; deja tabla para que el equipo humano firme después.
   - **MASSIVE es-ES**: intenta descargar de Hugging Face
     (`AmazonScience/massive`, config `es-ES`) y toma ~200 utterances de
     dominios ajenos como negativos adicionales de train. Si la descarga
     falla, documenta el intento y sigue solo con lo sintético.
2. **Extractor** (`ml/extractor/`):
   - Modelo base: el **Qwen3.5 instruct más pequeño disponible en HF que
     quepa en 8 GB en 4-bit** (verifica disponibilidad real; si la familia
     Qwen3.5 no está descargable, usa el Qwen3 instruct pequeño equivalente y
     documenta el porqué). Deja el id en una constante.
   - Prompt de extracción (few-shot corto) que produce SOLO JSON; parser
     robusto (recorte de fences, json inválido → fallo contado, no crash).
   - `ml/entrenar_lora.py`: QLoRA 4-bit (bitsandbytes) sobre train+val
     (chat template, target modules estándar), configurable por flags
     (épocas, lr, r, batch, `--salida ml/models/extractor-v1`). Checkpoints y
     adapter NO se comitean. Registra `ml/models/extractor-v1/metricas.json`
     (loss final, tiempo, VRAM pico, hiperparámetros) — ese JSON tampoco se
     comitea; su contenido va LITERAL en el reporte.
   - `ml/evaluar_extraccion.py`: corre el test set contra
     `--proveedor {base|lora|xai}` y emite por campo: exactitud exacta de
     `empleado`, `turno`, `accion`, `justificacion` (null-match cuenta), F1 de
     `fechas` (conjunto), % JSON válido, y exactitud total (todos los campos).
     Salida JSON + tabla markdown. `--proveedor xai` usa `XAI_API_KEY` si
     existe; sin clave, sale con mensaje claro (no es error de gate).
3. **Corridas reales** (GPU local, para el reporte):
   - Entrena LoRA v1 (documenta comando, duración y VRAM).
   - Evalúa `base` y `lora` sobre el test set y pega la tabla comparativa.
     Meta honesta: LoRA v1 debe superar claramente al base en exactitud total;
     si no lo logra, repórtalo igual con hipótesis (no maquilles números).
4. **Tests** (pytest, SIN GPU y SIN red): resolución de fechas relativas
   (casos fijos con `fecha_referencia` dada: «la otra semana» = lunes-domingo
   siguientes, «el puente» siguiente festivo con su lunes, «de hoy en ocho»),
   determinismo del generador, splits sin solape, parser JSON robusto
   (fences, ruido, inválido), métricas del harness con predicciones fixture
   (exactitud y F1 calculados a mano). El modelo real NUNCA se carga en tests.
5. **Calidad**: español, UTF-8 sin BOM, ruff verde, sin secretos.

## Gates (en ESTE worktree)

```
.venv/Scripts/python -m ruff check ml data        (venv 3.11 con requirements-dev.txt)
.venv/Scripts/python -m pytest ml/tests -v
npm run lint && npm test && npm run build          (no deben romperse)
```

más las corridas reales del punto 3 (venv GPU aparte con
`ml/requirements-gpu.txt`, FUERA del clone, p. ej. `../relevo-gpu-venv`).

## Entrega

- Reporte `docs/orca/reports/C3_LORA_REPORT.md`: decisiones (modelo elegido y
  por qué), conteos del dataset, salida LITERAL de gates, metricas.json
  literal, tabla base vs. LoRA v1, y muestra de 5 órdenes con su extracción.
  Hash = `git rev-parse HEAD`.
- Commit único: `feat(extractor): dataset de órdenes, QLoRA v1 y harness de evaluación (C3)`
- Sin push, sin merge, sin PR.
