# Métrica 3 — precisión del auditor

Los 10 escenarios de D2 se vuelven a ejecutar con los mismos fixtures (`tests/auditor/ayuda.ts`). Los 10 de F1 están en `evaluacion/escenarios_extra.ts` y en `tests/evaluacion/auditor_extra.test.ts`. El auditor corre en un puerto efímero, con `relevo_lector`, sin redactar razones con el modelo.

Aciertos 20/20. La etiqueta dorada es la clase que las reglas de D2 deben devolver en ese caso. Una precisión de 1.00 en esta tabla significa que el auditor sigue esas reglas, no que un humano independiente haya rotulado los casos.

| id | origen | título | esperado | predicho |
|---|---|---|---|---|
| p-inexistente | d2 | empleado inexistente | rechazado | rechazado |
| p-duplicado | d2 | turno duplicado el mismo día | rechazado | rechazado |
| p-ausencia | d2 | turno dentro de una ausencia aprobada | rechazado | rechazado |
| p-domingo | d2 | asignación en domingo | observaciones | observaciones |
| p-festivo | d2 | asignación en festivo 2026-10-12 | observaciones | observaciones |
| p-noche | d2 | turno noche | observaciones | observaciones |
| p-septimo | d2 | séptimo día de la semana | observaciones | observaciones |
| p-ausencia-turnos | d2 | ausencia sobre días con turnos activos | rechazado | rechazado |
| p-limpia | d2 | propuesta limpia | aprobado | aprobado |
| p-mixta | d2 | una acción limpia y otra en domingo | observaciones | observaciones |
| f1-festivo-trasladado | f1 | festivo trasladado (Reyes Magos, lunes 12 de enero) | observaciones | observaciones |
| f1-reyes-calendario | f1 | 6 de enero no es el festivo trasladado | aprobado | aprobado |
| f1-ausencia-cruza-semanas | f1 | ausencia que cruza dos semanas y pisa turnos | rechazado | rechazado |
| f1-noche-hacia-domingo | f1 | noche del sábado que amanece en domingo | observaciones | observaciones |
| f1-no-activo | f1 | id fuera del catálogo de activos | rechazado | rechazado |
| f1-dos-turnos | f1 | dos turnos el mismo día en una sola propuesta | rechazado | rechazado |
| f1-pasa-44 | f1 | la semana de Mónica queda en 48 horas | observaciones | observaciones |
| f1-reemplazo | f1 | cancelar el domingo y caer en la incapacidad del lunes | rechazado | rechazado |
| f1-noche-domingo | f1 | noche en domingo | observaciones | observaciones |
| f1-ausencia-sin-turno | f1 | ausencia que cruza dos semanas sin pisar turnos | aprobado | aprobado |

## Precisión por clase

| clase | precisión | soporte esperado |
|---|---:|---:|
| aprobado | 100.00 % | 3 |
| observaciones | 100.00 % | 9 |
| rechazado | 100.00 % | 8 |

## Matriz de confusión

Filas = esperado, columnas = predicho.

| esperado \\ predicho | aprobado | observaciones | rechazado |
|---|---:|---:|---:|
| aprobado | 3 | 0 | 0 |
| observaciones | 0 | 9 | 0 |
| rechazado | 0 | 0 | 8 |

El seed tiene 0 empleados con `activo = false`. `f1-no-activo` usa el id 999998, que `listar_empleados(activo=true)` trata igual que un inactivo: «no existe o no está activo». No se escribió en `empleados`.

`f1-noche-hacia-domingo` es la noche del sábado 2026-10-03. El auditor cuenta esas horas en la fecha de la asignación y observa el recargo nocturno; no marca el domingo en el que amanece. `f1-reyes-calendario` (2026-01-06) no es festivo en el catálogo Emiliani; el lunes 2026-01-12 sí. `f1-ausencia-sin-turno` cruza dos semanas y, como no pisa turnos, queda aprobada. `f1-pasa-44` suma la mañana del 8 de agosto a las cinco noches de Mónica Vargas Restrepo (empleado 12): 48 h, por encima de las 44. `f1-reemplazo` le quita a Blanca Becerra el domingo 16 de agosto y le asigna el lunes 10: ese lunes cae en su incapacidad aprobada del 7 al 10, y el auditor rechaza.
