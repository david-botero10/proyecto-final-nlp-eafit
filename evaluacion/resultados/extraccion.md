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
