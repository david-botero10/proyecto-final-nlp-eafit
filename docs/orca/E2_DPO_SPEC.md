# Spec E2 — ciclo DPO (la aprobación humana como dato de entrenamiento) + servicio del extractor

Ola E2 de Relevo (semana 4). Lee antes: `docs/ARQUITECTURA.md` (§1 innovación,
§6 `pares_preferencia`, §8 evals), `docs/PLAN_DESARROLLO.md` (D2 ciclo-dpo y
métrica 4), `CLAUDE.md`, `docs/orca/reports/C3_LORA_REPORT.md`, y el código
de C3: `ml/extractor/*` (entrenar, evaluar, metricas, modelo, parser, prompt),
`ml/entrenar_lora.py`, `ml/evaluar_extraccion.py`, `data/ordenes/*`. También
`mcp/escrituras.ts` (cómo D1 escribe `pares_preferencia`) y
`lib/agente/extraccion.ts` (contrato `POST {EXTRACTOR_URL}/extraer`).

## Objetivo

Cerrar el ciclo de **aprendizaje continuo** que es la innovación del proyecto:
los pares (propuesta, decisión humana) de `pares_preferencia` se exportan,
alimentan un ajuste **DPO incremental** sobre el adaptador LoRA v1 (sin
reentrenar desde cero) y se mide **antes/después** con el mismo test set
congelado. Además, el extractor afinado se expone como **servicio HTTP** para
que el asistente lo use (`EXTRACTOR_URL`) y podamos compararlo contra Grok en
la app real.

Contexto de resultados de C3 (test set, n=65): base 3,1 % exactitud total;
LoRA v1 **76,9 %** (fechas F1 84,6 %, acción 84,6 %). Los errores de v1 están
en fechas relativas y en la acción: ahí debe apuntar la señal DPO.

## Archivos que PUEDES tocar (nada más)

- `ml/dpo/**` (nuevo: exportación de pares, construcción del dataset DPO,
  entrenamiento, comparación)
- `ml/exportar_pares.py`, `ml/entrenar_dpo.py`, `ml/comparar_versiones.py`
  (CLIs delgados)
- `ml/servir_extractor.py` (nuevo servicio FastAPI del extractor)
- `ml/extractor/**` (solo AGREGAR funciones; no cambies firmas existentes)
- `ml/requirements-gpu.txt` (agregar `trl` si falta, `fastapi`, `uvicorn`)
- `ml/tests/test_dpo*.py`, `ml/tests/test_servir_extractor*.py`
- `data/ordenes/simular_decisiones.py` (nuevo) y
  `data/ordenes/decisiones_simuladas.jsonl`
- `package.json` (solo script `extractor:dev`)
- `.env.example` (documentar `EXTRACTOR_URL`, `EXTRACTOR_PORT`)
- `docs/orca/reports/E2_DPO_REPORT.md`

PROHIBIDO tocar: `.gitignore`, todo lo TS salvo `package.json`/`.env.example`,
`db/`, `corpus/`, `ml/corpus_lib/`, `ml/servir.py`, `ml/indexar.py`,
`ml/entrenar_lora.py`, `ml/evaluar_extraccion.py`, `data/ordenes/generar_*`,
`docs/*.md`. E1 corre en paralelo sobre lo TS.

## Requisitos

1. **Señal de preferencia** (`ml/dpo/pares.py` + `ml/exportar_pares.py`):
   lee `pares_preferencia` de PostgreSQL (`DATABASE_URL`, rol lector) y los
   convierte al formato DPO de TRL: `{prompt, chosen, rejected}` donde
   `prompt` = el mismo prompt de extracción de C3 aplicado a `prompt_texto`
   (con `fecha_referencia`), `chosen` = JSON de `elegida`, `rejected` = JSON
   de `rechazada`. Reglas: pares con `rechazada` NULL (aprobaciones limpias)
   no son pares de preferencia — se usan solo como SFT de refuerzo opcional
   (`--incluir-aprobaciones`); descarta pares donde `elegida == rechazada`.
   Exporta a `ml/runs/pares_dpo.jsonl` (no se comitea) y reporta conteos por
   `origen`.
2. **Decisiones simuladas** (`data/ordenes/simular_decisiones.py`, semilla
   42): como en pruebas reales habrá pocas decisiones humanas, genera un set
   demostrativo y honesto: toma ~120 órdenes NUEVAS (plantillas de val/test
   no usadas en train, o nuevas variantes), corre el extractor **LoRA v1**
   sobre ellas, compara con el `esperado` del generador, y produce
   decisiones: si coincide → `aprobacion`; si difiere → `correccion` con
   `elegida = esperado` y `rechazada = predicción v1`. Escribe
   `data/ordenes/decisiones_simuladas.jsonl` (comiteado) y las inserta en
   `propuestas` + `aprobaciones` + `pares_preferencia` con `usuario =
   "simulador"` y `orden_texto` marcado (para que el informe distinga
   humanas de simuladas). Deja claro en el reporte cuántas correcciones
   reales de v1 produjo (esa es la señal).
3. **DPO incremental** (`ml/dpo/entrenar.py` + `ml/entrenar_dpo.py`): parte
   del adaptador `ml/models/extractor-v1` (carga base 4-bit + adapter,
   `is_trainable=True`), entrena con `trl.DPOTrainer` (`beta` 0.1, 1–2 épocas,
   lr baja ~5e-6, mismo r/alpha; referencia = v1 congelado, con
   `ref_model=None` + peft para no duplicar memoria) sobre
   `pares_dpo.jsonl`, y guarda `ml/models/extractor-v2` + `metricas.json`
   (pares usados, loss, `rewards/accuracies`, tiempo, VRAM). Debe caber en
   8 GB: si la VRAM no alcanza, baja `max_length`/`max_prompt_length` y
   documenta.
4. **Comparación** (`ml/comparar_versiones.py`): corre
   `evaluar_filas` (de C3, reutilízalo) para `base`, `lora` (v1) y `lora-v2`
   (nuevo proveedor `--adapter`) sobre el **test set congelado**
   `data/ordenes/test.jsonl`, y emite una tabla única base | v1 | v2 con delta
   v1→v2 por campo, más **intervalos de confianza** bootstrap (1 000
   remuestreos) para la exactitud total. También, si hay `XAI_API_KEY`, la
   columna Grok (`--proveedor xai`, ya existe en C3); sin clave, columna
   «pendiente». Salida `ml/runs/comparacion.md` + JSON, y el contenido
   LITERAL va al reporte. **Honestidad**: si v2 no mejora o empeora, se
   reporta igual con hipótesis (poca señal, sobreajuste, beta); no se
   maquilla. Añade además una evaluación por **subgrupo de dificultad**
   (órdenes con fechas relativas vs. absolutas; acción `quitar` vs. resto)
   para localizar dónde ayuda el DPO.
5. **Servicio del extractor** (`ml/servir_extractor.py`, FastAPI): `POST
   /extraer` `{orden, fecha_referencia}` → `{empleado, turno, fechas,
   justificacion, accion}` (contrato de `lib/agente/extraccion.ts`), `GET
   /salud` con `{ok, version}`; `--adapter` elige v1 o v2 (default: v2 si
   existe, si no v1); GPU si hay, CPU si no. Script `npm run extractor:dev`.
   Latencia y VRAM en el reporte.
6. **Tests** (pytest, SIN GPU y SIN red): construcción de pares DPO desde
   filas fixture (filtra `rechazada` NULL e iguales; formato TRL exacto);
   simulador de decisiones con un extractor mock (clasifica aprobación vs.
   corrección correctamente); comparación: tabla y bootstrap con
   predicciones fixture (intervalo contiene la media); servicio: `/extraer`
   con modelo mock devuelve el contrato y `/salud` responde. Los modelos
   reales NUNCA se cargan en tests. Mantén verdes los tests de C3.
7. **Calidad**: español, UTF-8 sin BOM, ruff verde, sin secretos; pesos y
   `ml/runs/` no se comitean.

## Gates (en ESTE worktree)

```
.venv/Scripts/python -m ruff check ml data
.venv/Scripts/python -m pytest ml/tests -v
npm run lint && npm test && npm run build      (no deben romperse)
```

más las corridas reales (venv GPU `../relevo-gpu-venv` de C3): simular
decisiones → exportar pares → entrenar DPO → comparar → levantar el servicio
y un `curl` de humo a `/extraer` con «ponle el de la noche a Ana el puente».

## Entrega

- Reporte `docs/orca/reports/E2_DPO_REPORT.md`: decisiones, conteos de
  pares por origen, `metricas.json` de v2 literal, tabla comparativa
  base|v1|v2|(Grok) con intervalos y subgrupos, latencia del servicio,
  salida LITERAL de gates. Hash = `git rev-parse HEAD`.
- Commit único: `feat(dpo): ciclo DPO incremental v1→v2, comparación y servicio del extractor (E2)`
- Sin push, sin merge, sin PR.
