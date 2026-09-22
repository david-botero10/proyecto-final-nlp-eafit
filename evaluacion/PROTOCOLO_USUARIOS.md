# Protocolo de pruebas con usuarios

Sesión de 15 minutos con un coordinador (o alguien que haga de coordinador).
Los datos de la clínica son sintéticos. No se piden nombres reales, cédulas
ni nómina de una empresa. El participante se anota con un código
(`p01`, `p02`, …).

Regla que se dice al empezar: consultar es libre; nada se escribe en turnos
ni ausencias hasta que la persona pulse aprobar, corregir o rechazar en la
tarjeta. Lo que muestra la tarjeta es exactamente lo que se escribiría.

## Antes de la sesión

En la raíz del repo, con la base ya sembrada (no hace falta re-sembrar):

```text
docker compose up -d db phoenix
npm run embed:dev
npm run auditor:dev
npm run extractor:dev
npm run dev
```

- `db` es PostgreSQL en el puerto 5432. `phoenix` queda en el 6006.
- `embed:dev` necesita el venv `../relevo-ml-venv` y publica el puerto 8631.
  Sin ese proceso el chat sigue, pero la búsqueda de normas es solo léxica.
- `auditor:dev` escucha en `AUDITOR_PORT` (8641 si no se cambia).
- `extractor:dev` usa `../relevo-gpu-venv` y los adapters en `ml/models/`
  (o los del worktree donde se entrenaron). Sin adapter, la extracción
  de la orden cae al camino que tenga configurado el chat.
- `npm run dev` abre el chat en `http://localhost:3000`.
- Grok responde solo si `XAI_API_KEY` está en el entorno o en `.env`.
  Sin clave la interfaz avisa y no hay que fingir que el modelo contestó.

Quien facilita tiene a mano el seed: Elizabeth María López es la empleada 2;
Javier Fredy Narváez es la 11 y tiene incapacidad aprobada del 3 al 7 de
agosto de 2026. No se le dicta esa respuesta al participante.

## Guion (15 minutos)

| Minuto | Qué pasa |
|---|---|
| 0:00 | Bienvenida, la regla de la tarjeta y el código del participante. |
| 0:02 | Tareas 1 y 2 (datos). |
| 0:06 | Tareas 3, 4 y 5 (norma). |
| 0:10 | Tareas 6, 7 y 8 (escritura). |
| 0:13 | Seis preguntas en voz alta, escala 1 a 5. |
| 0:15 | Cierre. No se pide que “le dé una oportunidad” al sistema. |

### Tareas

1. **Datos.** «¿Quién cubre el turno de la noche el sábado?» Si pide fecha,
   usar el sábado 5 de septiembre de 2026. Anotar si la respuesta nombra
   personas del seed o se inventa una.
2. **Datos.** «¿Qué ausencias aprobadas hay en enfermería entre el 3 y el 7
   de agosto de 2026?» Anotar si aparece la incapacidad de ese rango.
3. **Norma.** «¿Cuánto es el recargo si alguien trabaja de noche?» Debe citar
   el artículo 168 (y puede citar el 160, que define el horario).
4. **Norma.** «¿Y si el turno cae en domingo o en festivo?» Debe citar el
   artículo 179.
5. **Norma.** «¿De cuántas horas es la jornada máxima a la semana, y qué pasó
   con la rebaja?» Debe citar el artículo 161. Anotar si mezcla 42 h (Ley
   2101 / texto indexado) con el tope de 44 h que usa el auditor.
6. **Escritura, caso limpio.** «Ponle la mañana del lunes 28 de septiembre de
   2026 a Elizabeth María López.» Esperado: tarjeta y auditor en `aprobado`.
   La persona decide. No se escribe hasta esa decisión.
7. **Escritura, el auditor observa.** «Ponle la mañana del domingo 4 de
   octubre de 2026 a Elizabeth María López.» Esperado: `observaciones` y
   cita del artículo 179. Anotar si aun así aprobaría.
8. **Escritura, el auditor rechaza.** «Ponle la mañana del 5 de agosto de
   2026 a Javier Fredy Narváez.» Esperado: `rechazado` (incapacidad aprobada
   en esa fecha). Anotar si la tarjeta deja claro que no se puede escribir.

## Qué observar

- Si la cita se ve (artículo y fragmento) o solo hay una frase suelta.
- Si la tarjeta muestra empleado, turno, fecha y veredicto antes del botón.
- Si la persona lee la tarjeta o aprueba de una. La pregunta 4 del
  cuestionario pregunta eso; aquí se anota lo que hizo de verdad en las
  tareas 6, 7 y 8.
- Dudas, repeticiones de la orden y momentos en que el sistema no contestó.
- No se corrige al participante durante la tarea. Las aclaraciones van al
  cierre.

## Cuestionario (1 = nada, 5 = del todo)

Se hace una vez, al final, sobre la sesión entera.

1. Claridad: entendí lo que me respondió.
2. Confianza en las citas: las normas que mostró me alcanzan para creerle.
3. Utilidad de la tarjeta: me sirvió para ver qué se iba a escribir.
4. ¿Aprobaría sin revisar la tarjeta?
5. Esfuerzo: me costó poco usarlo.
6. Intención de uso: lo usaría en una semana de turnos de verdad.

La pregunta 4 va al revés de las otras: un 5 significa que aprobaría a
ciegas. No se recodifica al anotar. El informe dirá el sentido.

## Cómo registrar

Una fila por sesión en `evaluacion/sesiones/plantilla.csv`.

- `t1` … `t8`: `si` si la respuesta o la tarjeta coincidió con lo esperado,
  `no` si no, `na` si no se alcanzó a hacer.
- `t6_decision`, `t7_decision`, `t8_decision`: `aprobar`, `corregir`,
  `rechazar` o `no_decidio`.
- Likert: enteros del 1 al 5, vacío solo si la sesión se cortó antes.
- `notas`: una frase. Sin nombres reales ni pegar la clave de API.

Después de una tanda, `npm run eval:aprobaciones` vuelve a leer la base.
Las filas con `usuario = simulador` no son estas sesiones. La tasa humana
sale de las propuestas cuyo usuario no es `simulador`.
