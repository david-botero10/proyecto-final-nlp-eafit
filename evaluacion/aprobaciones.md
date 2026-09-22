# Métrica 4 — tasa de aprobación humana y regresión entre versiones

Consulta de solo lectura (`SET ROLE relevo_lector`) sobre `propuestas`, `aprobaciones` y `pares_preferencia`. La tasa sin corrección es `estado = aprobada` dividido por las propuestas cuyo estado no es `pendiente`. `corregida` cuenta como decisión humana distinta: hubo tarjeta, pero el texto se cambió. El usuario `simulador` sale de `propuestas.usuario`; los pares no guardan usuario y se clasifican con el join.

## Propuestas por estado

| estado | n |
|---|---:
| aprobada | 91 |
| corregida | 29 |

## Por origen de la decisión

| usuario / estado | n |
|---|---:
| simulador / aprobada | 91 |
| simulador / corregida | 29 |

## Aprobaciones

| decisión | n |
|---|---:
| aprobar | 91 |
| corregir | 29 |

## Pares de preferencia

| usuario / origen | n |
|---|---:
| simulador / aprobacion | 91 |
| simulador / correccion | 29 |

## Tasas

Simulador: aprobación sin corrección 75.83 % (91/120). Es señal fabricada por `data/ordenes/simular_decisiones.py`, no una sesión con personas. No sirve para decir que el sistema ya convence a un coordinador.

No hay propuestas de usuarios humanos. La tasa humana queda pendiente hasta las sesiones del protocolo (`evaluacion/PROTOCOLO_USUARIOS.md`). Hoy el numerador y el denominador son 0.

Para la regresión entre versiones, el mismo SQL se vuelve a correr después de las sesiones. Los pares con `origen = correccion` son el lote que alimentó el DPO; los de `origen = aprobacion` quedaron fuera de ese entrenamiento. Una subida de la tasa humana sin corrección, de una sesión a la siguiente, sería la señal de que la versión nueva se equivoca menos. Con cero filas humanas esa comparación todavía no existe.

Vuelve a medirlo con `npm run eval:aprobaciones`.
