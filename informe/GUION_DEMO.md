# Guion de demo — Relevo (8 minutos)

Sustentación de SI7016. Fecha de referencia de los ejemplos: **lunes 21 de septiembre de 2026** (America/Bogota). Si la máquina está en otro día, no cambien las fechas absolutas de este guion: ya vienen escritas.

Perfil de toda la demo: **Coordinadora de enfermería**. No cambien el selector a mitad del guion: cambiar de usuario borra el hilo.

No usen el ejemplo de la pantalla «Ponle el de la mañana a Ana toda la otra semana». Ana Mery Montoya Patiño es de recepción. Con este perfil el sistema debe negarse. Doris Herrera Sánchez (empleado 5) es de enfermería y el nombre no choca con otra persona.

## Checklist previo (10 puntos)

1. PostgreSQL sigue en `localhost:5432`, base `relevo`, healthy. No ejecuten `docker compose down` ni `db/seed.py --reseed`. En esta máquina el contenedor que ya ocupa el puerto es `proyectofinalnlp2026-db-1`.
2. Phoenix arriba, sin tocar esa base: `docker compose up -d phoenix`. Abre `http://localhost:6006`.
3. `.env` local (no se proyecta, no se commitea) con `XAI_API_KEY`. El resto puede quedar como `.env.example`: `RELEVO_MODELO=grok-4.6`, `EMBED_SERVICE_URL=http://localhost:8631`, `AUDITOR_URL=http://127.0.0.1:8641`, `PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces`, `OTEL_SERVICE_NAME=relevo`. `EXTRACTOR_URL` vacío: la extracción de la demo la hace Grok.
4. Servicio de embeddings caliente. En otra terminal, venv de ML fuera del clone: `npm run embed:dev`. `GET http://127.0.0.1:8631/salud` devuelve `{"ok":true}`. Hagan una consulta de prueba antes de empezar: la primera carga de bge-m3 en CPU pasa de 3 s y esa consulta cae a léxico (reporte C1).
5. Auditor: `npm run auditor:dev`. `GET http://127.0.0.1:8641/.well-known/agent.json` devuelve `"name":"Relevo Auditor"`.
6. App: `npm run dev`. La página es `http://localhost:3000`, encabezado «Relevo», subtítulo «Asistente de turnos y ausencias».
7. Selector en **Coordinadora de enfermería** e hilo vacío. Si quedó otra conversación en el navegador, cambien el selector a Jefe de vigilancia y vuelvan a Coordinadora de enfermería: eso crea un id nuevo.
8. Cliente SQL abierto contra la misma base. Una línea basta: `docker exec -it proyectofinalnlp2026-db-1 psql -U relevo -d relevo`.
9. En Phoenix, localicen el proyecto y dejen visible el filtro del servicio `relevo`.
10. Plan B ensayado una vez (sección final): sin clave, el chat dice que configure `XAI_API_KEY`; el veredicto del domingo se muestra con `curl` al auditor, que no necesita xAI.

## Minuto 0:00 — Qué hay en pantalla

Servicios ya levantados. El navegador en el chat, el selector visible, Phoenix en otra ventana, la terminal de `psql` detrás. No arranquen contenedores en vivo.

Señal en voz: «Consultar no pide permiso. Escribir, sí. Vamos a hacer las dos cosas, y al final la fila.»

## Minuto 0:40 — Consulta de datos, con el perfil

Escriban exactamente:

```text
¿Quién cubre el turno de la noche el sábado 26 de septiembre?
```

Qué señalar:

- El chip de intención, cuando aparezca: consulta de datos, no norma.
- La respuesta debe nombrar, de enfermería, a **Diego Andrés Barreto**, **Elizabeth María López** y **Ruth González**. Esas tres filas están en el seed, turno N, estado `programada`, fecha 2026-09-26 (anexo A del informe).
- No deben aparecer Carlos Rodríguez Camargo ni Patricia Ortega Caicedo (recepción), ni Diana Alba Hernández Díaz ni Elizabeth María Toro Martínez (vigilancia): también cubren esa noche, y el perfil las recorta.

Si falta un nombre o sobra alguien de otro equipo, díganlo. No lo corrijan en voz como si el sistema hubiera acertado.

## Minuto 2:00 — Consulta normativa, con citas

Escriban exactamente:

```text
¿Cuánto es el recargo nocturno?
```

Qué señalar:

- El indicador «consultando norma…» mientras la tool trabaja.
- El panel **Fuentes**, numerado, con enlace. En el humo híbrido de C1 los dos primeros fueron el art. 169 (base del recargo) y el art. 168 (el treinta y cinco por ciento). El 168 es el que enuncia el 35 %.
- El texto de la respuesta tiene que apoyar el porcentaje en esa cita. Si dice un número y no hay chip, el guardrail de E1 debe anexar «Esta respuesta no cita la norma; verifícala». Señalen esa frase si sale.

La primera consulta híbrida, con el modelo ya en memoria, tardó 322 ms en C1. Si esta tarda más, no la rellenen: esperen.

## Minuto 3:20 — Orden que produce tarjeta y veredicto

Escriban exactamente:

```text
Ponle el de la mañana a Doris Herrera Sánchez del 28 de septiembre al 4 de octubre.
```

Qué señalar, en este orden:

1. El texto del asistente invita a revisar la tarjeta. No dice que el cambio ya quedó hecho.
2. La tarjeta: orden, interpretación, empleada Doris Herrera Sánchez, turno Mañana, una fila por día del 2026-09-28 al 2026-10-04.
3. El veredicto. Esa semana no tiene turnos previos de Doris ni ausencias (anexo A), así que no hay solape duro. Sí incluye el domingo 4 de octubre, siete días y 56 h (7 × 8). El auditor debe decir **observaciones**, citar el art. 179 y marcar la jornada fuera del límite. Es el mismo criterio que los escenarios 4, 7 y 10 del reporte D2.
4. Aprobar sigue habilitado: observaciones no bloquean. Rechazado sí lo haría.

Si Grok deja fuera el domingo, no fuercen el discurso. Quiten o no según lo que la tarjeta muestre, y digan qué veredicto llegó. El plan B de abajo no depende de este turno.

## Minuto 5:00 — Corrección y aprobación

1. Pulsen **Corregir**.
2. Quiten la fila del **2026-10-03** (sábado) y la del **2026-10-04** (domingo). Deben quedar cinco mañanas: 28, 29 y 30 de septiembre, 1 y 2 de octubre. Cinco días × 8 h = 40 h, bajo el tope de 44, sin domingo y sin festivo (el 12 de octubre no entra).
3. Confirmen la corrección. El texto esperado, por el componente de la tarjeta, empieza por «Quedó corregida».
4. Los tres botones quedan deshabilitados.

Qué decir: «La fila que se escribe es la que quedó después de quitar, no la orden original.»

`aprobaciones.usuario` queda `coordinador`. Es la constante `USUARIO_TARJETA`, no el id del selector. El selector sí acotó el equipo al crear la propuesta. No lo presenten como un bug a mitad de la frase: es el comportamiento de D1.

## Minuto 6:20 — La fila y el par

En `psql`:

```sql
SELECT e.nombre, t.codigo, a.fecha, a.estado, a.origen
FROM asignaciones a
JOIN empleados e ON e.id = a.empleado_id
JOIN turnos t ON t.id = a.turno_id
WHERE a.origen = 'tarjeta'
ORDER BY a.fecha;
```

Señalen `origen = tarjeta`, turno `M`, las cinco fechas, nombre de Doris.

```sql
SELECT p.estado, ap.decision, ap.usuario, pp.origen
FROM propuestas p
JOIN aprobaciones ap ON ap.propuesta_id = p.id
JOIN pares_preferencia pp ON pp.propuesta_id = p.id
WHERE p.decidido_en IS NOT NULL
ORDER BY p.decidido_en DESC
LIMIT 1;
```

Señalen `estado = corregida`, `decision = corregir`, `pp.origen = correccion`. En una corrección, `rechazada` es la extracción original y `elegida` refleja las acciones que quedaron (reporte D1). No hace falta abrir el JSON entero si el tiempo aprieta: digan qué columna es la señal de DPO.

Antes de esta demo la base tenía 0 filas `origen = 'tarjeta'`. Las 120 propuestas del `simulador` no escribieron nómina. Si la consulta devuelve más de cinco filas, filtren por el nombre de Doris y por `fecha >= '2026-09-28'`.

## Minuto 7:10 — Traza en Phoenix

Vuelvan a `http://localhost:6006`. Abran la traza nueva del servicio `relevo`, no una vieja.

Qué señalar:

- Un span `relevo.turno` (kind AGENT). En el turno simulado de E1 el status fue OK y el padre fue `POST /api/chat`.
- Si el modelo respondió, deberían verse también `relevo.router` y, en la orden, `relevo.extraccion`.
- El atributo de usuario del turno es el del selector (`coordinadora_enfermeria` en el span de E1 era `gerencia`, porque ese turno se hizo con Gerencia).

Cierre, en una frase: «La traza no aprueba nada. La aprobación es la tarjeta, y la fila ya está en la base.»

## Plan B si falla la red

Sin `XAI_API_KEY`, o si xAI no responde, el chat no inventa el turno. Responde el stream simulado. El reporte E1 guardó el texto: «Soy Relevo. Aún no tengo modelo conectado… configura XAI_API_KEY». Enseñen esa burbuja y sigan. No reintenten la misma pregunta esperando otro resultado.

El veredicto no necesita al asistente. Con el auditor del punto 5 del checklist, en PowerShell (el cuerpo es el del reporte D2):

```powershell
$body = @'
{"jsonrpc":"2.0","id":"demo-b","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"propuesta_id":"demo-domingo","orden_texto":"Ponle la mañana el domingo 4 de octubre.","extraccion":{"empleado":"Elizabeth María López","turno":"M","fechas":["2026-10-04"],"justificacion":null},"acciones":[{"tipo":"asignar_turno","empleado_id":2,"turno":"M","fecha":"2026-10-04"}],"contexto":{"solapes_detectados":[],"ausencias_en_rango":[]}}}]}}}
'@
curl.exe -sS -X POST http://127.0.0.1:8641/a2a -H "Content-Type: application/json" --data-binary $body
```

El veredicto esperado es `observaciones`, art. 179. Los id de tarea cambian en cada llamada.

Phoenix igual recibe el turno simulado: es lo que E1 ya demostró con el span `relevo.turno`. Si el export falla, el chat sigue; díganlo y muestren la captura del informe (sección 5.6) en vez de una traza vacía.

La tabla del extractor (3,08 % → 76,92 % → 83,08 %, n = 65, reportes C3 y E2) está en la diapositiva y no depende de la red. Úsenla si la demo de la tarjeta no se pudo completar. No afirmen que esa tabla compara contra Grok: esa columna sigue pendiente.

## Qué no hacer en estos ocho minutos

- No re-siembren la base.
- No abran `.env` en el proyector.
- No pulsen Aprobar sobre una tarjeta `rechazado`: el botón está deshabilitado, y forzarlo no es el camino.
- No presenten las 120 filas del simulador como usuarios del curso.
