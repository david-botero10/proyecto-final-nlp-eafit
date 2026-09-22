# Reporte C3 — lora-v1

Worktree `c3-lora`, rama `david-botero10/c3-lora`, base `9d9b939`.
GPU: NVIDIA GeForce RTX 4060 Laptop (8 GB). Python del venv de gates:
3.11.16. El venv de entrenamiento está fuera del clone, en
`../relevo-gpu-venv` (torch 2.11.0+cu128, transformers 5.17.0, peft 0.21.0,
trl 1.13.0, bitsandbytes 0.50.2).

## Decisión de modelo

`Qwen/Qwen3.5-0.8B`. Es el checkpoint post-entrenado (instruct) más pequeño
de la familia Qwen3.5 en Hugging Face (marzo 2026; el base hermano es
`Qwen/Qwen3.5-0.8B-Base`). En 4-bit cabe de sobra en 8 GB: el pico medido
durante el QLoRA fue 2871.62 MiB. Los hermanos 2B y 4B también cabrían en
inferencia 4-bit; la spec pide el más pequeño que quepa.

`AutoModelForCausalLM.from_pretrained` con bitsandbytes NF4 cargó el
modelo (320 tensores). No hizo falta el respaldo Qwen3. La arquitectura
híbrida (Gated DeltaNet) corrió con el fallback de PyTorch: no están
instalados `causal_conv1d` ni `flash-linear-attention`. Es correcto y más
lento. Por eso el entrenamiento tardó 4635 s.

## Dataset

Semilla 42. Nombres leídos de `db/seed/02_empleados.sql` (nómina
sintética). Detalle de fechas, alias y la muestra de 30 en
`data/ordenes/VALIDACION.md`.

| archivo | líneas | qué hay |
|---|---:|---|
| `train.jsonl` | 580 | 350 órdenes + 30 negativos sintéticos + 200 de MASSIVE |
| `val.jsonl` | 55 | 50 órdenes + 5 negativos |
| `test.jsonl` | 65 | 60 órdenes (moldes no vistos) + 5 negativos |

Positivos: 170/24 asignar, 90/13 ausencia y 90/13 quitar en train/val;
20 de cada acción en test. Train/val de esos moldes sale de
`sha256(orden) % 8` (0 → val). El test no comparte plantilla con el pool.

MASSIVE es-ES: el config con script falló
(`RuntimeError: Dataset scripts are no longer supported, but found massive.py`).
El espejo parquet `refs/convert/parquet`, archivo `es-ES/train/0000.parquet`,
sí cargó (11 514 filas). Se excluyeron calendar (id 2) y alarm (id 16).
Mensaje literal del generador:

```
parquet refs/convert/parquet es-ES/train (el script falló: RuntimeError: Dataset scripts are no longer supported, but found massive.py); 200 de 9122 (sin calendar ni alarm, semilla 42); agregados a train: 200
```

## Entrenamiento

```
..\relevo-gpu-venv\Scripts\python.exe ml\entrenar_lora.py --epocas 3 --lr 0.0002 --r 16 --batch 1 --grad-acum 8 --salida ml\models\extractor-v1
```

635 ejemplos (train+val), 240 pasos, 3 épocas, assistant-only loss,
`enable_thinking=false`. El ejemplo más largo tokenizó a 1074 tokens
(`--max-longitud 1536`). Adapter y `metricas.json` quedan en
`ml/models/extractor-v1/` y no se comitean (`.gitignore`).

`metricas.json` literal:

```json
{
  "modelo_base": "Qwen/Qwen3.5-0.8B",
  "loss_final": 0.003536789612250383,
  "segundos": 4635.067,
  "vram_pico_bytes": 3011115520,
  "vram_pico_mib": 2871.62,
  "gpu": "NVIDIA GeForce RTX 4060 Laptop GPU",
  "ejemplos": 635,
  "hiperparametros": {
    "epocas": 3.0,
    "lr": 0.0002,
    "r": 16,
    "lora_alpha": 32,
    "lora_dropout": 0.05,
    "batch": 1,
    "grad_acum": 8,
    "max_longitud": 1536,
    "optim": "adamw_8bit",
    "cuantizacion": "bitsandbytes nf4 double quant",
    "modulos_lora": "(?:^|.*\\.)(?:down_proj|gate_proj|in_proj_qkv|in_proj_z|k_proj|o_proj|out_proj|q_proj|up_proj|v_proj)$"
  }
}
```

## Evaluación en el test (n = 65)

```
..\relevo-gpu-venv\Scripts\python.exe ml\evaluar_extraccion.py --proveedor base --salida ml\runs\eval-base.json
..\relevo-gpu-venv\Scripts\python.exe ml\evaluar_extraccion.py --proveedor lora --adapter ml\models\extractor-v1 --salida ml\runs\eval-lora.json
```

| métrica | base | LoRA v1 |
|---|---:|---:|
| empleado | 80.00 % | 100.00 % |
| turno | 36.92 % | 100.00 % |
| accion | 55.38 % | 84.62 % |
| justificacion | 53.85 % | 98.46 % |
| fechas (F1) | 19.18 % | 84.62 % |
| JSON válido | 90.77 % | 100.00 % |
| exactitud total | 3.08 % | 76.92 % |

LoRA v1 supera al base en todos los campos. La exactitud total pasa de
3.08 % a 76.92 %. El campo que más se le resiste es `accion` (84.62 %):
en la muestra, «no le deje turno el 12 de octubre» salió como ausencia y
con otra fecha. Las fechas de «el lunes» también fallan a veces (predijo
el día siguiente en vez del lunes).

`--proveedor xai`, salida literal:

```
Sin XAI_API_KEY: se omite el proveedor xai. No es un error de gate.
```

## Cinco órdenes y la extracción LoRA

1. Error de acción y de fecha.

- orden: `A Alejandra Herrera no le deje turno el 12 de octubre.`
- fecha_referencia: `2026-09-23`
- esperado: `{"empleado": "Alejandra Herrera", "turno": null, "fechas": ["2026-10-12"], "justificacion": null, "accion": "quitar"}`
- predicción: `{"empleado": "Alejandra Herrera", "turno": null, "fechas": ["2026-10-17"], "justificacion": null, "accion": "ausencia"}`

2. Ausencia correcta (puente = viernes de Boyacá).

- orden: `Alejandro Padilla se ausenta el puente; la razón es que pidió permiso.`
- fecha_referencia: `2026-08-05`
- esperado: `{"empleado": "Alejandro Felipe Padilla", "turno": null, "fechas": ["2026-08-07"], "justificacion": "permiso", "accion": "ausencia"}`
- predicción: igual al esperado

3. Asignar: persona, turno y acción bien; la fecha no.

- orden: `Asígnele la noche completa a Bernardo el lunes, gracias.`
- fecha_referencia: `2026-09-23`
- esperado: `{"empleado": "Bernardo Daniel Vargas Martínez", "turno": "N", "fechas": ["2026-09-28"], "justificacion": null, "accion": "asignar"}`
- predicción: `{"empleado": "Bernardo Daniel Vargas Martínez", "turno": "N", "fechas": ["2026-09-24"], "justificacion": null, "accion": "asignar"}`

4. Negativo correcto.

- orden: `Chao, que le vaya bien en el turno.`
- fecha_referencia: `2026-10-19`
- esperado: `null`
- predicción: `null`

5. Quitar correcto (puente = lunes 16 de noviembre).

- orden: `Elimine la asignación de Antonio el puente.`
- fecha_referencia: `2026-11-04`
- esperado: `{"empleado": "Antonio Felipe Parra López", "turno": null, "fechas": ["2026-11-16"], "justificacion": null, "accion": "quitar"}`
- predicción: igual al esperado

## Gates

En este worktree, uno tras otro. Los tres quedaron en verde.

```
.venv/Scripts/python -m ruff check ml data
```

```
All checks passed!
```

```
.venv/Scripts/python -m pytest ml/tests -v
```

```
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\c3-lora\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\c3-lora\ml
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 31 items

ml\tests\test_chunking.py::test_chunker_separa_tres_articulos_con_ref PASSED [  3%]
ml\tests\test_chunking.py::test_titulos_de_capitulo_quedan_como_contexto PASSED [  6%]
ml\tests\test_chunking.py::test_particionado_articulo_largo_respeta_solape PASSED [  9%]
ml\tests\test_chunking.py::test_pdf_minimo_extrae_texto_y_ref_pagina PASSED [ 12%]
ml\tests\test_chunking.py::test_cartilla_ventanas_con_solape_y_ref_de_pagina PASSED [ 16%]
ml\tests\test_chunking.py::test_html_utf8_con_bom_sin_charset_no_produce_mojibake PASSED [ 19%]
ml\tests\test_extractor.py::test_f1_de_conjuntos_a_mano PASSED           [ 22%]
ml\tests\test_extractor.py::test_metricas_con_fixture_calculado_a_mano PASSED [ 25%]
ml\tests\test_extractor.py::test_parser_acepta_fences_ruido_y_null PASSED [ 29%]
ml\tests\test_extractor.py::test_parser_no_revienta_con_json_invalido PASSED [ 32%]
ml\tests\test_extractor.py::test_parser_rechaza_turno_fuera_de_contrato PASSED [ 35%]
ml\tests\test_extractor.py::test_prompt_incluye_nomina_y_fechas_del_resolver PASSED [ 38%]
ml\tests\test_manifiesto.py::test_hash_sha256_es_estable_y_de_64_hex PASSED [ 41%]
ml\tests\test_manifiesto.py::test_hash_archivo_coincide_con_bytes PASSED [ 45%]
ml\tests\test_manifiesto.py::test_no_redescarga_si_el_hash_ya_existe PASSED [ 48%]
ml\tests\test_manifiesto.py::test_fuente_dataclass_minima PASSED         [ 51%]
ml\tests\test_ordenes.py::test_la_otra_semana_es_lunes_a_domingo_siguientes PASSED [ 54%]
ml\tests\test_ordenes.py::test_el_puente_es_el_siguiente_festivo_con_su_lunes PASSED [ 58%]
ml\tests\test_ordenes.py::test_de_hoy_en_ocho PASSED                     [ 61%]
ml\tests\test_ordenes.py::test_pasado_manana_finde_y_octubre PASSED      [ 64%]
ml\tests\test_ordenes.py::test_puente_de_semana_santa_incluye_jueves_y_viernes PASSED [ 67%]
ml\tests\test_ordenes.py::test_calendario_2026_tiene_los_festivos_conocidos PASSED [ 70%]
ml\tests\test_ordenes.py::test_alias_inequivocos_y_diminutivo_de_ana PASSED [ 74%]
ml\tests\test_ordenes.py::test_generador_es_determinista_y_cubre_cuotas PASSED [ 77%]
ml\tests\test_ordenes.py::test_hash_separa_train_y_val_sin_fuga_de_molde PASSED [ 80%]
ml\tests\test_ordenes.py::test_genero_de_la_incapacidad_concuerda PASSED [ 83%]
ml\tests\test_ordenes.py::test_main_escribe_utf8_sin_bom PASSED          [ 87%]
ml\tests\test_ordenes.py::test_jsonl_comiteado_cubre_el_generador PASSED [ 90%]
ml\tests\test_ordenes.py::test_negativos_se_cortan_por_sha256 PASSED     [ 93%]
ml\tests\test_sin_bd.py::test_sin_bd_jsonl_metadatos_completos PASSED    [ 96%]
ml\tests\test_sin_bd.py::test_limit_recorta_chunks PASSED                [100%]

============================= 31 passed in 1.13s ==============================
```

```
npm run lint && npm test && npm run build
```

ESLint no imprimió hallazgos. Ruff, dentro de `npm run lint`, imprimió
`All checks passed!`. Vitest: 4 archivos, 9 tests, todos passed.
`pytest db/tests`: 6 passed. `pytest ml/tests`: 31 passed. `next build`
compiló (aviso previo de `@ai-sdk/provider-utils`, no introducido aquí) y
generó las 5 páginas estáticas. Exit code 0.

## Hash

El hash de esta ola es la salida de `git rev-parse HEAD` en este worktree
(rama `david-botero10/c3-lora`) después del commit único. El informe va en
ese mismo commit; no se hace amend para incrustar el SHA.
