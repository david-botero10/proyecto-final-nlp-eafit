# Métrica 1 — exactitud de extracción

Reutiliza `ml/comparar_versiones.py` sobre `data/ordenes/test.jsonl`. Orden: base, LoRA v1, DPO v2 y, si hay clave, Grok (`--proveedor` no hace falta: la comparación llama a xAI sola). Intervalos: 1000 remuestreos, semilla 42, percentil 2.5–97.5.

| métrica | base | v1 | v2 | delta v1→v2 | Grok |
|---|---:|---:|---:|---:|---:|
| empleado | 80.00 % | 100.00 % | 100.00 % | +0.00 pp | 100.00 % |
| turno | 36.92 % | 100.00 % | 100.00 % | +0.00 pp | 100.00 % |
| accion | 55.38 % | 84.62 % | 96.92 % | +12.31 pp | 100.00 % |
| justificacion | 53.85 % | 98.46 % | 98.46 % | +0.00 pp | 100.00 % |
| fechas (F1) | 19.18 % | 84.62 % | 84.62 % | +0.00 pp | 98.46 % |
| JSON válido | 90.77 % | 100.00 % | 100.00 % | +0.00 pp | 100.00 % |
| exactitud total | 3.08 % | 76.92 % | 83.08 % | +6.15 pp | 98.46 % |

## Intervalos de la exactitud total

| versión | exactitud total | IC 95 % (bootstrap) |
|---|---:|---:|
| base | 3.08 % | [0.00 %, 7.69 %] |
| v1 | 76.92 % | [66.15 %, 87.69 %] |
| v2 | 83.08 % | [73.85 %, 90.77 %] |
| Grok | 98.46 % | [95.38 %, 100.00 %] |

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

## Análisis

En el test congelado (n=65) la exactitud total pasa de 3.08 % en el modelo base a 76.92 % con LoRA v1 y a 83.08 % con DPO v2 (+6.15 pp de v1 a v2). El IC 95 % bootstrap de v1 es [66.15 %, 87.69 %] y el de v2 es [73.85 %, 90.77 %]. Los intervalos de v1 y v2 se solapan, así que el delta no queda separado del ruido de remuestreo. Grok, en el mismo test, queda en 98.46 % (+15.38 pp frente a v2).

El movimiento no es parejo. Quitar (n=20): total 0.00 % → 50.00 % → 70.00 % (+20.00 pp); acción 50.00 % → 90.00 %; F1 de fechas 75.00 % → 75.00 %. Resto (n=45): total 4.44 % → 88.89 % → 88.89 % (+0.00 pp); acción 100.00 % → 100.00 %; F1 de fechas 88.89 % → 88.89 %. Fechas relativas (n=57): total 1.75 % → 82.46 % → 89.47 % (+7.02 pp); acción 91.23 % → 98.25 %; F1 de fechas 91.23 % → 91.23 %. Fechas absolutas (n=5): total 0.00 % → 0.00 % → 0.00 % (+0.00 pp); acción 0.00 % → 80.00 %; F1 de fechas 0.00 % → 0.00 %. Sin fecha en la orden (n=3): total 33.33 % → 100.00 % → 100.00 % (+0.00 pp); acción 100.00 % → 100.00 %; F1 de fechas 100.00 % → 100.00 %. Donde v2 gana de verdad es en quitar: ahí la acción se corrige y la exactitud total sube. En el resto la exactitud total casi no se mueve. La F1 de fechas se queda quieta en los subgrupos grandes: el DPO cambió la acción, no el calendario. En las fechas absolutas el n es chico; aunque la acción mejore, la exactitud total puede seguir en cero porque la fecha sigue mal.

Con este n no se puede decir que v2 ya sea el extractor que hay que desplegar por encima de v1 en todos los campos. Empleado y turno ya estaban en 100.00 % y 100.00 % en v1; el JSON válido de v2 es 100.00 %. Grok ya está en la misma tabla: el juicio es si el afinado la alcanza en este n. Los pesos no van en el repo: el script usa ml/models si el adapter está, y si no el worktree hermano e2-dpo.
