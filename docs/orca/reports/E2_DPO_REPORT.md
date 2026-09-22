# Reporte E2 — ciclo DPO

Worktree `e2-dpo`, rama `david-botero10/e2-dpo`, base `ead5009`.
GPU: NVIDIA GeForce RTX 4060 Laptop (8 GB, nvidia-smi reporta 8188 MiB).
Python del venv de gates: 3.11.16. El venv de entrenamiento está fuera del
clone, en `../relevo-gpu-venv` (torch 2.11.0+cu128, transformers 5.17.0,
peft 0.21.0, trl 1.13.0). TRL 1.13 ya no tiene `max_prompt_length`; el corte
es `max_length`. Con 1536 no se descartó ningún par (29/29) y no hizo falta
bajarlo.

La base local ya tenía el seed (40 empleados, 1837 asignaciones). Antes de
esta ola, `pares_preferencia` estaba vacía: no hay decisiones humanas. Toda
la señal de abajo es simulada y va marcada con `usuario = simulador`. No se
escribió en `empleados`, `asignaciones` ni `ausencias`.

## Decisiones

El prompt DPO es el de C3 (`construir_mensajes`, con `enable_thinking=false`).
`chosen` y `rejected` son el JSON del contrato, o la cadena `null`. Una
aprobación con `rechazada` NULL no entra al DPO. Un par con las dos
extracciones equivalentes se descarta. Las 91 aprobaciones limpias no se
usaron como SFT: el entrenamiento corrió sin `--incluir-aprobaciones`.

Las 120 órdenes nuevas salen de los moldes de test (no están en train) y de
empleados que no produjeron ese texto en train, val ni test. Semilla 42.
No son las filas del test congelado.

`prompt_texto` de una fila simulada guarda la marca y la fecha:

```
[simulador fecha_referencia=YYYY-MM-DD]
<orden>
```

Si una fila humana no trae esa marca, la fecha de referencia es el día de
`creado_en` en America/Bogota. En esta corrida no hubo ninguna.

## Simulación (LoRA v1)

```
..\relevo-gpu-venv\Scripts\python.exe -u data\ordenes\simular_decisiones.py
```

120 órdenes, todas con JSON válido. 91 coinciden con el esperado
(`aprobacion`, no son par de preferencia). 29 difieren (`correccion`):
esa es la señal. Por molde, las correcciones son 12 de `test-asig-asignele`
(«el lunes»), 8 de `test-quit-desprograme`, 6 de `test-quit-octubre`
(«el 12 de octubre»), y una de `test-asig-cambie`, `test-asig-mire` y
`test-aus-novedad`.

El patrón es el de C3: «el lunes» conserva la acción y falla la fecha;
«no le deje turno el 12 de octubre» sale como ausencia y con otra fecha.
El JSONL comiteado es `data/ordenes/decisiones_simuladas.jsonl` (120 líneas,
UTF-8 sin BOM). Se insertaron 120 filas en `propuestas`, `aprobaciones` y
`pares_preferencia`.

## Exportación

```
..\relevo-gpu-venv\Scripts\python.exe -u ml\exportar_pares.py
```

```json
{
  "leidos": 120,
  "por_origen": {
    "aprobacion": 91,
    "correccion": 29
  },
  "por_marca": {
    "simulador": 120
  },
  "descartados_iguales": 0,
  "dpo": 29,
  "sft": 0
}
```

`ml/runs/pares_dpo.jsonl` no se comitea.

## Entrenamiento v2

```
..\relevo-gpu-venv\Scripts\python.exe -u ml\entrenar_dpo.py
```

Parte de `ml/models/extractor-v1` con el adaptador entrenable. `ref_model=None`:
TRL 1.13 copia ese adaptador a uno congelado `ref` y no carga un segundo
modelo. 1 época, lr 5e-6, beta 0.1, batch 1, acumulación 4, 8 pasos.
`ml/models/extractor-v2` no se comitea.

`metricas.json` literal:

```json
{
  "modelo_base": "Qwen/Qwen3.5-0.8B",
  "adapter_origen": "C:\\Users\\davbo\\orca\\workspaces\\Proyecto Final NLP 2026\\e2-dpo\\ml\\models\\extractor-v1",
  "pares_leidos": 29,
  "pares_usados": 29,
  "loss_final": 0.5862218737602234,
  "loss_media_log": 0.5862218737602234,
  "rewards/accuracies": 0.6875,
  "historial": [
    {
      "loss": 0.6931471824645996,
      "grad_norm": 19.5,
      "learning_rate": 5e-06,
      "entropy": 0.020401625079102814,
      "num_tokens": 7870.0,
      "logits/chosen": -1.6858470008007276,
      "logits/rejected": -1.7204939975924691,
      "mean_token_accuracy": 0.9632832556962967,
      "rewards/chosen": 0.0,
      "rewards/rejected": 0.0,
      "rewards/accuracies": 0.0,
      "rewards/margins": 0.0,
      "logps/chosen": -10.558390140533447,
      "logps/rejected": -0.4172797203063965,
      "epoch": 0.13793103448275862,
      "step": 1
    },
    {
      "loss": 0.6329951882362366,
      "grad_norm": 17.25,
      "learning_rate": 4.3750000000000005e-06,
      "entropy": 0.020402038237079978,
      "num_tokens": 15891.0,
      "logits/chosen": -1.7159112385317865,
      "logits/rejected": -1.734665600683304,
      "mean_token_accuracy": 0.9765205681324005,
      "rewards/chosen": 0.11685729213058949,
      "rewards/rejected": -0.019693088193889707,
      "rewards/accuracies": 0.5,
      "rewards/margins": 0.13655038154684007,
      "logps/chosen": -8.979594707489014,
      "logps/rejected": -0.5418052673339844,
      "epoch": 0.27586206896551724,
      "step": 2
    },
    {
      "loss": 0.6172930002212524,
      "grad_norm": 14.9375,
      "learning_rate": 3.7500000000000005e-06,
      "entropy": 0.011467603937489912,
      "num_tokens": 23769.0,
      "logits/chosen": -1.688974291772184,
      "logits/rejected": -1.7003113830181034,
      "mean_token_accuracy": 0.9748774468898773,
      "rewards/chosen": 0.03009100030180889,
      "rewards/rejected": -0.15275883376580168,
      "rewards/accuracies": 0.5,
      "rewards/margins": 0.1828498397480871,
      "logps/chosen": -10.465070247650146,
      "logps/rejected": -1.9419026374816895,
      "epoch": 0.41379310344827586,
      "step": 3
    },
    {
      "loss": 0.47105085849761963,
      "grad_norm": 22.5,
      "learning_rate": 3.125e-06,
      "entropy": 0.02361335713067092,
      "num_tokens": 31663.0,
      "logits/chosen": -1.6841489028620389,
      "logits/rejected": -1.6904925624141676,
      "mean_token_accuracy": 0.989999994635582,
      "rewards/chosen": 0.29753270000219345,
      "rewards/rejected": -0.23695583455264568,
      "rewards/accuracies": 1.0,
      "rewards/margins": 0.5344885438680649,
      "logps/chosen": -5.53993034362793,
      "logps/rejected": -2.867758274078369,
      "epoch": 0.5517241379310345,
      "step": 4
    },
    {
      "loss": 0.6018929481506348,
      "grad_norm": 10.1875,
      "learning_rate": 2.5e-06,
      "entropy": 0.009520747174974531,
      "num_tokens": 39539.0,
      "logits/chosen": -1.6829925414981473,
      "logits/rejected": -1.6847764396202414,
      "mean_token_accuracy": 0.9695422351360321,
      "rewards/chosen": 0.237723830203322,
      "rewards/rejected": 0.0036045076335540216,
      "rewards/accuracies": 0.5,
      "rewards/margins": 0.23411931968257704,
      "logps/chosen": -9.580329418182373,
      "logps/rejected": -0.1744217872619629,
      "epoch": 0.6896551724137931,
      "step": 5
    },
    {
      "loss": 0.4941158890724182,
      "grad_norm": 15.0,
      "learning_rate": 1.8750000000000003e-06,
      "entropy": 0.02439298667013645,
      "num_tokens": 47428.0,
      "logits/chosen": -1.5968942268568695,
      "logits/rejected": -1.686086764031268,
      "mean_token_accuracy": 0.9640646278858185,
      "rewards/chosen": 0.3799716502435331,
      "rewards/rejected": -0.11777558643370867,
      "rewards/accuracies": 1.0,
      "rewards/margins": 0.49774724687449634,
      "logps/chosen": -9.458375453948975,
      "logps/rejected": -1.5287747383117676,
      "epoch": 0.8275862068965517,
      "step": 6
    },
    {
      "loss": 0.5039930939674377,
      "grad_norm": 16.125,
      "learning_rate": 1.25e-06,
      "entropy": 0.011622583755524829,
      "num_tokens": 55326.0,
      "logits/chosen": -1.6593776791696566,
      "logits/rejected": -1.659021894128823,
      "mean_token_accuracy": 0.9851960837841034,
      "rewards/chosen": 0.11957655008882284,
      "rewards/rejected": -0.37118437150456884,
      "rewards/accuracies": 1.0,
      "rewards/margins": 0.4907609294168651,
      "logps/chosen": -5.557929039001465,
      "logps/rejected": -4.190699577331543,
      "epoch": 0.9655172413793104,
      "step": 7
    },
    {
      "loss": 0.6752868294715881,
      "grad_norm": 9.125,
      "learning_rate": 6.25e-07,
      "entropy": 0.013024284504354,
      "num_tokens": 57306.0,
      "logits/chosen": -1.6366710316051136,
      "logits/rejected": -1.6470619895241476,
      "mean_token_accuracy": 0.9636363387107849,
      "rewards/chosen": 0.035282135009765625,
      "rewards/rejected": -0.0007633209461346269,
      "rewards/accuracies": 1.0,
      "rewards/margins": 0.03604545444250107,
      "logps/chosen": -10.124992370605469,
      "logps/rejected": -0.1755828857421875,
      "epoch": 1.0,
      "step": 8
    },
    {
      "train_runtime": 206.1334,
      "train_samples_per_second": 0.141,
      "train_steps_per_second": 0.039,
      "total_flos": 178318462390272.0,
      "train_loss": 0.5862218737602234,
      "epoch": 1.0,
      "step": 8
    }
  ],
  "segundos": 206.434,
  "vram_pico_bytes": 8838432768,
  "vram_pico_mib": 8428.99,
  "gpu": "NVIDIA GeForce RTX 4060 Laptop GPU",
  "hiperparametros": {
    "epocas": 1,
    "lr": 5e-06,
    "beta": 0.1,
    "batch": 1,
    "grad_acum": 4,
    "max_longitud": 1536,
    "optim": "adamw_8bit",
    "ref_model": null,
    "cuantizacion": "bitsandbytes nf4 double quant"
  }
}
```

PyTorch midió 8428.99 MiB de pico. La tarjeta reporta 8188 MiB y el paso
terminó sin OOM. El tiempo de `train()` es 206.1 s; el de pared del bloque
de entrenamiento, 206.434 s.

## Comparación en el test congelado (n = 65)

```
..\relevo-gpu-venv\Scripts\python.exe -u ml\comparar_versiones.py
```

No hay `XAI_API_KEY` en el entorno ni un `.env` en este worktree. La columna
Grok queda pendiente. Contenido literal de `ml/runs/comparacion.md`:

```
| métrica | base | v1 | v2 | delta v1→v2 | Grok |
|---|---:|---:|---:|---:|---:|
| empleado | 80.00 % | 100.00 % | 100.00 % | +0.00 pp | pendiente |
| turno | 36.92 % | 100.00 % | 100.00 % | +0.00 pp | pendiente |
| accion | 55.38 % | 84.62 % | 96.92 % | +12.31 pp | pendiente |
| justificacion | 53.85 % | 98.46 % | 98.46 % | +0.00 pp | pendiente |
| fechas (F1) | 19.18 % | 84.62 % | 84.62 % | +0.00 pp | pendiente |
| JSON válido | 90.77 % | 100.00 % | 100.00 % | +0.00 pp | pendiente |
| exactitud total | 3.08 % | 76.92 % | 83.08 % | +6.15 pp | pendiente |

## Intervalos de la exactitud total

| versión | exactitud total | IC 95 % (bootstrap) |
|---|---:|---:|
| base | 3.08 % | [0.00 %, 7.69 %] |
| v1 | 76.92 % | [66.15 %, 87.69 %] |
| v2 | 83.08 % | [73.85 %, 90.77 %] |
| Grok | pendiente | pendiente |

Remuestreos: 1000. El intervalo es el percentil 2.5–97.5 de la media.

## Fechas relativas (n = 57)

| métrica | base | v1 | v2 | delta v1→v2 |
|---|---:|---:|---:|---:|
| exactitud total | 1.75 % | 82.46 % | 89.47 % | +7.02 pp |
| accion | 52.63 % | 91.23 % | 98.25 % | +7.02 pp |
| fechas (F1) | 18.37 % | 91.23 % | 91.23 % | +0.00 pp |

## Fechas absolutas (n = 5)

| métrica | base | v1 | v2 | delta v1→v2 |
|---|---:|---:|---:|---:|
| exactitud total | 0.00 % | 0.00 % | 0.00 % | +0.00 pp |
| accion | 100.00 % | 0.00 % | 80.00 % | +80.00 pp |
| fechas (F1) | 20.00 % | 0.00 % | 0.00 % | +0.00 pp |

## Sin fecha en la orden (n = 3)

| métrica | base | v1 | v2 | delta v1→v2 |
|---|---:|---:|---:|---:|
| exactitud total | 33.33 % | 100.00 % | 100.00 % | +0.00 pp |
| accion | 33.33 % | 100.00 % | 100.00 % | +0.00 pp |
| fechas (F1) | 33.33 % | 100.00 % | 100.00 % | +0.00 pp |

## Acción quitar (n = 20)

| métrica | base | v1 | v2 | delta v1→v2 |
|---|---:|---:|---:|---:|
| exactitud total | 0.00 % | 50.00 % | 70.00 % | +20.00 pp |
| accion | 95.00 % | 50.00 % | 90.00 % | +40.00 pp |
| fechas (F1) | 23.93 % | 75.00 % | 75.00 % | +0.00 pp |

## Resto (no quitar) (n = 45)

| métrica | base | v1 | v2 | delta v1→v2 |
|---|---:|---:|---:|---:|
| exactitud total | 4.44 % | 88.89 % | 88.89 % | +0.00 pp |
| accion | 37.78 % | 100.00 % | 100.00 % | +0.00 pp |
| fechas (F1) | 17.07 % | 88.89 % | 88.89 % | +0.00 pp |

## Lectura

v2 sube la exactitud total en el test congelado.

Sin XAI_API_KEY: la columna Grok queda pendiente. No es un error de gate.
```

El CLI además imprimió: `Sin XAI_API_KEY: se omite el proveedor xai. No es un error de gate.`

v1 acierta 50/65 y v2 acierta 54/65. Esos 4 casos nuevos están todos en
`quitar` (50 % → 70 %, +4 de 20) y, dentro de ellas, en fechas relativas.
La F1 de fechas no se mueve en ningún subgrupo: el DPO corrigió la acción
(quitar frente a ausencia), no el calendario. En las 5 órdenes con fecha
absoluta («el 12 de octubre») la acción pasa de 0 % a 80 % y la exactitud
total sigue en 0 %: la fecha sigue mal. Los intervalos de v1 y v2 se
solapan, así que con n = 65 el +6.15 pp no queda separado del ruido; el
lugar donde la señal sí se ve es el subgrupo `quitar`.

## Servicio

`npm run extractor:dev` lanza
`../relevo-gpu-venv/Scripts/python.exe ml/servir_extractor.py`
en `127.0.0.1` y `EXTRACTOR_PORT` (8642). El adapter por defecto es v2
porque `ml/models/extractor-v2/adapter_config.json` existe.

```
salud 200 {"ok":true,"version":"v2"}
extraer 200 69.087s {"empleado":"Ana Mery Montoya Patiño","turno":"N","fechas":["2026-10-12"],"justificacion":null,"accion":"asignar"}
extraer 200 11.098s {"empleado":"Ana Mery Montoya Patiño","turno":"N","fechas":["2026-10-12"],"justificacion":null,"accion":"asignar"}
```

Orden de humo: «ponle el de la noche a Ana el puente» con
`fecha_referencia` 2026-09-21. El resolver de C3 da `2026-10-12` para
«puente» en ese día, y la respuesta lo trae. 69.087 s es la primera
petición, con la carga del modelo. La segunda, ya caliente, tarda 11.098 s
(el mismo fallback de PyTorch de C3, sin `causal_conv1d` ni
`flash-linear-attention`). nvidia-smi, con el modelo residente:
1135 MiB de 8188 MiB.

## Gates

En este worktree, uno tras otro. Quedaron en verde.

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
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\e2-dpo\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\e2-dpo\ml
configfile: pyproject.toml
plugins: anyio-4.14.2, Faker-40.37.0
collecting ... collected 48 items

ml\tests\test_chunking.py::test_chunker_separa_tres_articulos_con_ref PASSED [  2%]
ml\tests\test_chunking.py::test_titulos_de_capitulo_quedan_como_contexto PASSED [  4%]
ml\tests\test_chunking.py::test_particionado_articulo_largo_respeta_solape PASSED [  6%]
ml\tests\test_chunking.py::test_pdf_minimo_extrae_texto_y_ref_pagina PASSED [  8%]
ml\tests\test_chunking.py::test_cartilla_ventanas_con_solape_y_ref_de_pagina PASSED [ 10%]
ml\tests\test_chunking.py::test_html_utf8_con_bom_sin_charset_no_produce_mojibake PASSED [ 12%]
ml\tests\test_dpo_comparar.py::test_intervalo_contiene_la_media PASSED   [ 14%]
ml\tests\test_dpo_comparar.py::test_clase_de_fecha PASSED                [ 16%]
ml\tests\test_dpo_comparar.py::test_tabla_tiene_delta_y_pendiente PASSED [ 18%]
ml\tests\test_dpo_comparar.py::test_aciertos_totales_del_detalle PASSED  [ 20%]
ml\tests\test_dpo_pares.py::test_marca_recupera_la_fecha_y_la_orden PASSED [ 22%]
ml\tests\test_dpo_pares.py::test_aprobacion_limpia_no_entra_al_dpo PASSED [ 25%]
ml\tests\test_dpo_pares.py::test_aprobacion_limpia_puede_ir_a_sft PASSED [ 27%]
ml\tests\test_dpo_pares.py::test_iguales_se_descartan PASSED             [ 29%]
ml\tests\test_dpo_pares.py::test_correccion_tiene_el_formato_trl PASSED  [ 31%]
ml\tests\test_dpo_pares.py::test_rechazo_con_elegida_null_es_par PASSED  [ 33%]
ml\tests\test_dpo_simulador.py::test_coincidencia_es_aprobacion PASSED   [ 35%]
ml\tests\test_dpo_simulador.py::test_diferencia_es_correccion PASSED     [ 37%]
ml\tests\test_dpo_simulador.py::test_null_contra_null_es_aprobacion PASSED [ 39%]
ml\tests\test_dpo_simulador.py::test_ordenes_nuevas_no_repiten_los_splits PASSED [ 41%]
ml\tests\test_dpo_simulador.py::test_jsonl_utf8_sin_bom PASSED           [ 43%]
ml\tests\test_extractor.py::test_f1_de_conjuntos_a_mano PASSED           [ 45%]
ml\tests\test_extractor.py::test_metricas_con_fixture_calculado_a_mano PASSED [ 47%]
ml\tests\test_extractor.py::test_parser_acepta_fences_ruido_y_null PASSED [ 50%]
ml\tests\test_extractor.py::test_parser_no_revienta_con_json_invalido PASSED [ 52%]
ml\tests\test_extractor.py::test_parser_rechaza_turno_fuera_de_contrato PASSED [ 54%]
ml\tests\test_extractor.py::test_prompt_incluye_nomina_y_fechas_del_resolver PASSED [ 56%]
ml\tests\test_manifiesto.py::test_hash_sha256_es_estable_y_de_64_hex PASSED [ 58%]
ml\tests\test_manifiesto.py::test_hash_archivo_coincide_con_bytes PASSED [ 60%]
ml\tests\test_manifiesto.py::test_no_redescarga_si_el_hash_ya_existe PASSED [ 62%]
ml\tests\test_manifiesto.py::test_fuente_dataclass_minima PASSED         [ 64%]
ml\tests\test_ordenes.py::test_la_otra_semana_es_lunes_a_domingo_siguientes PASSED [ 66%]
ml\tests\test_ordenes.py::test_el_puente_es_el_siguiente_festivo_con_su_lunes PASSED [ 68%]
ml\tests\test_ordenes.py::test_de_hoy_en_ocho PASSED                     [ 70%]
ml\tests\test_ordenes.py::test_pasado_manana_finde_y_octubre PASSED      [ 72%]
ml\tests\test_ordenes.py::test_puente_de_semana_santa_incluye_jueves_y_viernes PASSED [ 75%]
ml\tests\test_ordenes.py::test_calendario_2026_tiene_los_festivos_conocidos PASSED [ 77%]
ml\tests\test_ordenes.py::test_alias_inequivocos_y_diminutivo_de_ana PASSED [ 79%]
ml\tests\test_ordenes.py::test_generador_es_determinista_y_cubre_cuotas PASSED [ 81%]
ml\tests\test_ordenes.py::test_hash_separa_train_y_val_sin_fuga_de_molde PASSED [ 83%]
ml\tests\test_ordenes.py::test_genero_de_la_incapacidad_concuerda PASSED [ 85%]
ml\tests\test_ordenes.py::test_main_escribe_utf8_sin_bom PASSED          [ 87%]
ml\tests\test_ordenes.py::test_jsonl_comiteado_cubre_el_generador PASSED [ 89%]
ml\tests\test_ordenes.py::test_negativos_se_cortan_por_sha256 PASSED     [ 91%]
ml\tests\test_servir_extractor.py::test_extraer_devuelve_el_contrato PASSED [ 93%]
ml\tests\test_servir_extractor.py::test_null_no_es_extraccion PASSED     [ 95%]
ml\tests\test_sin_bd.py::test_sin_bd_jsonl_metadatos_completos PASSED    [ 97%]
ml\tests\test_sin_bd.py::test_limit_recorta_chunks PASSED                [100%]

============================== warnings summary ===============================
.venv\Lib\site-packages\fastapi\testclient.py:1
  C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\e2-dpo\.venv\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 48 passed, 1 warning in 2.30s ========================
```

```
npm run lint
```

ESLint no imprimió hallazgos. Ruff, dentro de `npm run lint`, imprimió
`All checks passed!`. Exit code 0.

```
npm test
```

Vitest: 16 archivos, 70 tests, todos passed. `pytest db/tests`: 6 passed.
`pytest ml/tests`: 48 passed, con el aviso previo de Starlette sobre
`httpx` y `TestClient` (no introducido por la aserción). Exit code 0.

```
npm run build
```

`next build` compiló. El aviso de `@ai-sdk/provider-utils` («Critical
dependency: the request of a dependency is an expression») ya estaba en C3.
Generó las 5 páginas. Exit code 0.

## Hash

El hash de esta ola es la salida de `git rev-parse HEAD` en este worktree
(rama `david-botero10/e2-dpo`) después del commit único. El informe va en
ese mismo commit; no se hace amend para incrustar el SHA.
