# Validación del dataset de órdenes (C3)

Dataset sintético de Relevo, semilla 42. Los nombres salen de
`db/seed/02_empleados.sql` (nómina ficticia). Nada de este archivo es un
dato real.

## Qué se comprobó solo con código

Lo cubren `ml/tests/test_ordenes.py` y los asserts del generador. No es
revisión humana:

- 460 órdenes positivas: 350 train / 50 val / 20+20+20 test, repartidas en
  asignar, ausencia y quitar.
- 40 negativos sintéticos (charla o consulta): 30 train / 5 val / 5 test,
  ordenados por SHA-256 y cortados en ese orden.
- Train/val de los positivos del pool: `sha256(orden) % 8 == 0` va a val;
  el resto a train. Si la cubeta ya está llena, el ejemplo se descarta: no
  se mueve de split.
- Los moldes de test no comparten `id` ni plantilla con el pool. Las
  frases del few-shot del prompt no aparecen en ningún split.
- Cada alias apunta a un solo empleado. «Diego» y «Elizabeth» a secas no
  se usan: hay dos personas con ese primer nombre.
- «está incapacitada» solo con primer nombre femenino; «está incapacitado»
  solo con primer nombre masculino.
- Fechas de la etiqueta = `resolver_fechas` contra `fecha_referencia`.
- Dos corridas seguidas producen el mismo JSONL. UTF-8 sin BOM.
- MASSIVE es-ES: 200 negativos extra solo en train (ver abajo). El test
  no los mezcla.

Reglas de fecha que el código fija y los tests pinchan:

| expresión | regla | ancla comprobada |
|---|---|---|
| la otra semana | lunes a domingo siguientes | 2026-09-09 → 14 al 20 |
| el puente | próximo festivo; si es lunes, ese lunes; Jueves y Viernes Santos juntos | 2026-09-09 → 2026-10-12; 2026-04-01 → 2 y 3 de abril |
| de hoy en ocho | +7 días (mismo día de la semana) | 2026-09-09 → 2026-09-16 |
| el finde | sábado y domingo que vienen | 2026-09-09 → 12 y 13 |
| pasado mañana | +2 días | 2026-09-09 → 2026-09-11 |
| la primera semana de octubre | 1 al 7 de octubre | 2026-09-09 → 1 al 7 |

El calendario es la lista cerrada de `festivos.py` (19 fechas de 2026,
incluida la Virgen de Chiquinquirá el lunes 13 de julio).

## MASSIVE es-ES

Intento con `datasets` 5.0.1:

```
load_dataset("AmazonScience/massive", "es-ES", split="train")
→ RuntimeError: Dataset scripts are no longer supported, but found massive.py
```

Respaldo que sí cargó: parquet
`AmazonScience/massive` revisión `refs/convert/parquet`, archivo
`es-ES/train/0000.parquet` (11 514 filas, columna `utt`). En ese espejo
`scenario` es un entero. Se excluyeron calendar (2: reuniones y eventos)
y alarm (16: «despiértame el viernes»), porque se parecen a una orden.
Quedaron 9 122 utterances; se tomaron 200 con semilla 42, todas con
`esperado: null`, solo en `train.jsonl`.

Mensaje literal del generador:

```
parquet refs/convert/parquet es-ES/train (el script falló: RuntimeError: Dataset scripts are no longer supported, but found massive.py); 200 de 9122 (sin calendar ni alarm, semilla 42); agregados a train: 200
```

## Revisión manual de 30 ejemplos

La hizo el worker que armó el dataset, no el equipo del curso. La muestra
es el paso uniforme sobre los positivos ordenados por el texto (semilla
implícita: el orden alfabético), así que se puede repetir con
`muestra_revision`.

Veredicto «correcto» quiere decir: el alias es de esa persona, la acción
y el turno cuadran con la frase, y las fechas caen donde dice la regla de
arriba. No es un juicio de estilo literario.

| # | split | orden | etiqueta | veredicto | nota |
|---|---|---|---|---|---|
| 1 | test | A Alejandra Herrera no le deje turno el 12 de octubre. | quitar, 2026-10-12 | correcto | ref 23 sep (mié); el 12 de octubre es lunes |
| 2 | train | Anote que Blanca Becerra queda por fuera el puente: tiene incapacidad. | ausencia, incapacidad, 2026-08-07 | correcto | ref 5 ago; el próximo festivo es el viernes de Boyacá, no un lunes |
| 3 | train | Anote que Nubia Torres queda por fuera el puente: tiene incapacidad. | Nubia Piedad Guevara Torres, 2026-08-07 | correcto | «Nubia Torres» no choca con nadie más |
| 4 | train | Cancele lo de Blanca Becerra el puente. | quitar, 2026-11-16 | correcto | ref 4 nov; el próximo festivo es el lunes 16 (Cartagena) |
| 5 | train | Cancele lo de Karen Reyes el puente. | quitar, 2026-10-12 | correcto | ref 30 sep → lunes 12 de octubre |
| 6 | train | Dayana María Torres Gutiérrez no viene el finde: pidió permiso. | ausencia, permiso, 7 y 8 nov | correcto | ref mié 4 nov → sáb y dom |
| 7 | train | Doris Sánchez no viene el finde: pidió permiso. | Doris Herrera Sánchez, 8 y 9 ago | correcto | primer nombre + apellido |
| 8 | test | Hay que liberar a Melissa Clemencia la otra semana; queda sin turno. | quitar, 5 al 11 oct | correcto | ref mié 30 sep; la otra semana es lun–dom |
| 9 | train | Hágame el favor y asígnele el de la tarde a Camila el finde. | Camila Ríos, T, 7 y 8 nov | correcto | |
| 10 | val | Hágame el favor y asígnele el de la tarde a Karen Reyes el finde. | T, 8 y 9 ago | correcto | |
| 11 | train | Javier no viene el finde: pidió permiso. | Javier Fredy Narváez, 12 y 13 sep | correcto | ref 9 sep |
| 12 | train | Marcela Londoño no viene el finde: pidió permiso. | Marcela Vargas Londoño, 26 y 27 sep | correcto | no es María Marcela Torres |
| 13 | train | Necesito que Bibiana cubra el de la mañana de hoy en ocho, de una. | Bibiana Liliana Cárdenas Palacio, M, 2026-09-09 | correcto | ref 2 sep + 7 días |
| 14 | train | Necesito que Hernán cubra el de la mañana de hoy en ocho, de una. | M, 2026-10-07 | correcto | ref 30 sep + 7 |
| 15 | train | Nubia Torres no viene el finde: pidió permiso. | 5 y 6 sep | correcto | ref 2 sep |
| 16 | train | Oiga, programe a Gilberto Albeiro en el de la tarde pasado mañana. | T, 2026-11-20 | correcto | ref mié 18 nov; +2 es viernes |
| 17 | val | Parce, Alberto Loaiza queda con el turno de la noche el puente. | Alberto César Loaiza, N, 2026-10-12 | correcto | |
| 18 | train | Parce, Diana Alba queda con el turno de la noche el puente. | Diana Alba Hernández Díaz, N, 2026-10-12 | correcto | ref 16 sep; septiembre no tiene festivo |
| 19 | val | Parce, Melissa Clemencia queda con el turno de la noche el puente. | N, 2026-11-02 | correcto | ref lun 19 oct → lunes de Todos los Santos |
| 20 | test | Que Brayan entre a la jornada de la mañana el finde, ¿listo? | M, 5 y 6 sep | correcto | molde de test, no está en train |
| 21 | train | Quítele el turno a Carlos Rodríguez la otra semana. | 9 al 15 nov | correcto | lun–dom; «Carlos Rodríguez» es Carlos Rodríguez Camargo |
| 22 | train | Quítele el turno a Karen la otra semana. | 28 sep al 4 oct | correcto | ref mié 23 sep |
| 23 | train | Regístrele la ausencia a Alejandra la otra semana porque se le murió un familiar. | fallecimiento familiar, 23 al 29 nov | correcto | |
| 24 | train | Regístrele la ausencia a Diego Barreto la otra semana porque se le murió un familiar. | Diego Andrés Barreto, 5 al 11 oct | correcto | no es Diego Sandoval |
| 25 | train | Regístrele la ausencia a Melissa Clemencia García Reyes la otra semana porque se le murió un familiar. | 17 al 23 ago | correcto | ref vie 14 ago; la otra semana empieza el lunes 17 |
| 26 | train | Sáquele la programación a Ana Mery el finde, porfa. | Ana Mery Montoya Patiño, 15 y 16 ago | correcto | el seed no trae «Ana María»; «Ana» / «Ana Mery» / «Anita» son ella |
| 27 | train | Sáquele la programación a Doris Herrera Sánchez el finde, porfa. | 7 y 8 nov | correcto | |
| 28 | train | Sáquele la programación a Patricia Caicedo el finde, porfa. | Patricia Ortega Caicedo, 26 y 27 sep | correcto | |
| 29 | train | Ve, ponle el de la mañana a Carlos Camargo la otra semana. | M, 28 sep al 4 oct | correcto | |
| 30 | train | Ve, ponle el de la mañana a Johana López Pineda la otra semana. | M, 28 sep al 4 oct | correcto | |

En estos 30 no vi una etiqueta que contradiga la frase. Lo que sí se
nota, y no lo maquillo: varias órdenes usan el nombre largo en vez de un
apodo, y «el puente» a veces es un viernes (Boyacá, 7 de agosto) porque
la regla es «el próximo festivo», no «el próximo lunes» a toda costa.
Quien firme puede marcar esas filas si prefiere otra convención.

## Firma del equipo

Esta tabla queda vacía a propósito. El worker no firma por las personas
del curso.

| integrante | fecha | ¿de acuerdo con la muestra? | observación |
|---|---|---|---|
| Isabel Jurado | | | |
| Alejandro Silva | | | |
| David Botero | | | |
