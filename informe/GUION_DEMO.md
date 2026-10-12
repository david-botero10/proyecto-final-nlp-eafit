# Runbook de la demo en vivo — Relevo

Sustentación de SI7016. Demo de unos 5 minutos, cuatro interacciones. Para el hilo de la charla y la teoría de cada lámina, ver `informe/GUION_PRESENTACION.md` (lámina 4).

Verificada el 12 de octubre de 2026 con Grok 4.7 (`RELEVO_MODELO=grok-4.7`). Todos los comandos son de PowerShell, desde la raíz del repositorio.

Regla de oro: **el modelo no escribe; la persona aprueba**. Si algo sale distinto de lo esperado, se dice lo que llegó. No se corrige en voz alta como si el sistema hubiera acertado.

## 1. Antes de la clase (el día anterior)

1. Traer lo último y las dependencias:

   ```powershell
   git pull
   npm ci
   ```

2. `.env` en la raíz (no se proyecta, no se commitea, nunca se abre frente al público). Mínimo:

   ```text
   XAI_API_KEY=<la clave, solo en este archivo>
   RELEVO_MODELO=grok-4.7
   EXTRACTOR_URL=
   ```

   `EXTRACTOR_URL` vacío: la extracción de la demo la hace Grok y la app no intenta llamar al extractor local. (`.env.example` trae `http://127.0.0.1:8642`; si el servicio está apagado la app cae a Grok de todos modos, pero vacío evita el intento.) El resto de variables pueden quedar como en `.env.example` (`AUDITOR_URL=http://127.0.0.1:8641`, `EMBED_SERVICE_URL=http://localhost:8631`, `PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces`).

3. Base arriba y con datos. No se re-siembra ni se ejecuta `docker compose down -v`:

   ```powershell
   docker compose up -d db
   docker compose ps
   docker compose exec -T db psql -U relevo -d relevo -c "SELECT (SELECT count(*) FROM chunks) AS chunks, (SELECT count(*) FROM documentos) AS documentos, (SELECT count(*) FROM empleados) AS empleados, (SELECT count(*) FROM propuestas WHERE orden_texto LIKE '[simulador%') AS propuestas_simulador;"
   ```

   Valores esperados: `chunks` 589, `documentos` 20, `empleados` 40, `propuestas_simulador` 120.

4. **Dejar la base limpia de ensayos anteriores.** Primero se mira qué se borraría; las filas del simulador (`orden_texto` que empieza por `[simulador`) y toda la nómina del seed quedan intactas:

   ```powershell
   $previa = @'
   SELECT p.id, p.usuario, p.estado, left(p.orden_texto, 60) AS orden
   FROM propuestas p
   WHERE p.orden_texto NOT LIKE '[simulador%'
   ORDER BY p.creado_en;
   SELECT count(*) AS asignaciones_tarjeta FROM asignaciones WHERE origen = 'tarjeta';
   SELECT count(*) AS asignaciones_de_propuestas_demo_no_tarjeta
   FROM asignaciones
   WHERE propuesta_id IN (SELECT id FROM propuestas WHERE orden_texto NOT LIKE '[simulador%')
     AND origen <> 'tarjeta';
   '@
   $previa | docker compose exec -T db psql -U relevo -d relevo
   ```

   La última consulta debe dar 0 (la demo no cancela filas del seed). Si da más de 0, **no continúen**: revisen a mano qué hizo ese ensayo.

   Borrado, en una transacción, solo de lo creado por los ensayos (filas `origen = 'tarjeta'`, y las propuestas pendientes o decididas que no son del simulador, con sus aprobaciones y pares):

   ```powershell
   $reset = @'
   BEGIN;
   CREATE TEMP TABLE demo_propuestas AS
     SELECT id FROM propuestas WHERE orden_texto NOT LIKE '[simulador%';
   DELETE FROM pares_preferencia WHERE propuesta_id IN (SELECT id FROM demo_propuestas);
   DELETE FROM aprobaciones      WHERE propuesta_id IN (SELECT id FROM demo_propuestas);
   DELETE FROM asignaciones      WHERE origen = 'tarjeta' AND propuesta_id IN (SELECT id FROM demo_propuestas);
   DELETE FROM ausencias         WHERE propuesta_id IN (SELECT id FROM demo_propuestas);
   DELETE FROM propuestas        WHERE id IN (SELECT id FROM demo_propuestas);
   COMMIT;
   SELECT
     (SELECT count(*) FROM propuestas WHERE orden_texto LIKE '[simulador%') AS propuestas_simulador,
     (SELECT count(*) FROM propuestas WHERE orden_texto NOT LIKE '[simulador%') AS propuestas_demo,
     (SELECT count(*) FROM asignaciones WHERE origen = 'tarjeta') AS asignaciones_tarjeta;
   '@
   $reset | docker compose exec -T db psql -U relevo -d relevo
   ```

   Esperado: `propuestas_simulador` 120, `propuestas_demo` 0, `asignaciones_tarjeta` 0. Si `propuestas_simulador` no es 120, algo se borró de más: paren y avisen al equipo. Las conversaciones y mensajes de los ensayos pueden quedar; no afectan la demo.

5. **Calentamiento.** Con la pila mínima de la sección 3 arriba, correr una vez las cuatro interacciones de la sección 5 (incluida la aprobación) y luego repetir el reseteo del paso 4. La primera petición compila rutas de Next y es lenta; la segunda ya es la real.

6. **Grabar la demo.** Durante ese ensayo, grabar la pantalla completa de las cuatro interacciones (video con voz opcional) y guardar el archivo en `docs/entrega/`. Es el plan B si falla la red.

## 2. Memoria: pila mínima

Esta máquina tiene 15,7 GB y estaba en unos 2,5 GB libres. Pila recomendada para la demo:

| Servicio | ¿Encendido? | Por qué |
|---|---|---|
| PostgreSQL (`db`) | Sí | Nómina, corpus, propuestas |
| Auditor (`npm run auditor:dev`, puerto 8641) | Sí | Veredicto de la tarjeta por A2A |
| Web (`npm run dev`, puerto 3000) | Sí | El chat |
| Servicio de embeddings (`npm run embed:dev`, puerto 8631) | **No** | bge-m3 pesa; con poca RAM compite con todo lo demás |
| Extractor local (`npm run extractor:dev`, puerto 8642) | **No** | Necesita GPU y memoria; la extracción la hace Grok |
| Phoenix (`docker compose up -d phoenix`, puerto 6006) | Solo si sobra RAM | Es vistoso pero no hace falta para nada de lo demás |

Sin el servicio de embeddings, la búsqueda de normas **cae a modo léxico y aun así responde correctamente** (verificado el 12 de octubre: el recargo nocturno salió con el 35 % y los artículos 168, 169 y 134). Lo que cambia: las cifras de recuperación de la presentación (recall@5 100 %, MRR 0,933) son del modo híbrido. Si preguntan, se dice: «hoy, por memoria, la demo corre en modo léxico; las métricas son del híbrido».

Antes de empezar:

```powershell
# Memoria física libre, en GB
[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 1)

# Contenedores de otros proyectos que estén corriendo
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```

- Cerrar navegadores con muchas pestañas, IDE, Teams, Slack y similares.
- Detener los contenedores de **otros** proyectos (`docker stop <nombre>`). No detener el de este proyecto.
- Objetivo: más de 4 GB libres. Si no se llega, no encender Phoenix.

## 3. Treinta minutos antes

En orden. Una terminal por servicio, en la raíz del repositorio.

```powershell
# Terminal 1 — base
docker compose up -d db
docker compose ps          # db debe estar "healthy"
```

```powershell
# Terminal 2 — auditor (puerto 8641)
npm run auditor:dev
```

```powershell
# Terminal 3 — web (http://localhost:3000)
npm run dev
```

Opcional, solo si la memoria alcanza:

```powershell
docker compose up -d phoenix     # http://localhost:6006
```

Chequeos de salud, desde una cuarta terminal:

```powershell
# El auditor responde con su Agent Card (debe aparecer "Relevo Auditor")
curl.exe -s http://127.0.0.1:8641/.well-known/agent.json

# La web responde 200
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:3000
```

Luego:

1. Abrir `http://localhost:3000` (encabezado «Relevo», subtítulo «Asistente de turnos y ausencias»). Hacer zoom del navegador para que se lea desde atrás.
2. Un **ensayo completo** de las cuatro interacciones (sección 5), seguido del reseteo del paso 1.4 de este documento. Es el último ensayo: después de él, la base queda limpia.
3. Cerrar la pestaña del ensayo, abrir una nueva y dejar el selector en **Gerencia** con el hilo vacío. Terminal de `psql` a mano, por si se quiere mostrar la fila:

   ```powershell
   docker compose exec db psql -U relevo -d relevo
   ```

4. Verificar que `.env` no esté abierto en ningún editor visible.

## 4. Datos que conviene tener presentes

- Fecha de la máquina: «el próximo domingo» se resuelve contra el día de hoy en Bogotá. El 12 de octubre de 2026 (lunes) resolvió al **2026-10-18**. En otra fecha la tarjeta mostrará otro domingo; el auditor seguirá diciendo «domingo» y el artículo 179. Lo único que cambia es el número.
- Nómina sintética: la última fecha con asignaciones del seed es el 2026-09-27; no hay solapes con fechas posteriores.
- Alias: «Elizabeth» a secas coincide con dos personas (Elizabeth María López, de enfermería, y Elizabeth María Toro Martínez, de vigilancia). Por eso la orden de la demo lleva el nombre completo. Si el jurado pregunta, se muestra la desambiguación: es un comportamiento deseado.
- No usar el ejemplo de la pantalla «Ponle el de la mañana a Ana…»: Ana Mery Montoya Patiño es de recepción y, con el perfil de enfermería, el sistema debe negarse.

## 5. Durante la demo: las cuatro interacciones

Las latencias son las verificadas el 12 de octubre. Mientras el sistema trabaja, no se queda en silencio: se cuenta lo que está pasando.

### Interacción 1 — Norma (perfil **Gerencia**), unos 25 s

Escribir exactamente:

```text
¿Cuánto me pagan de recargo si trabajo de noche?
```

Qué señalar:

- El **chip de intención**: «consulta de norma» (el router, 0,95 de confianza en el ensayo).
- El indicador **«consultando norma…»** mientras la herramienta trabaja.
- Que el modelo **decidió buscar y buscó cuatro veces**, refinando la consulta (RAG agéntico).
- La respuesta: **35 % de recargo**, con el art. 168 del Código Sustantivo del Trabajo, el art. 169 (base), el art. 134 (pago) y la excepción de la Ley 2101 (art. 161) para la jornada de 6 horas y 36 semanales; menciona el salario uniforme pactado.
- El panel **Fuentes**, numerado `[n]`, con enlace al texto.

Mientras espera (unos 25 s): «El modelo está decidiendo cuántas veces buscar. Cada búsqueda es una vuelta al modelo; es el costo de que él decida, y a cambio refina la consulta».

Si aparece «Esta respuesta no cita la norma; verifícala», se señala: es el guardrail funcionando.

### Cambio de perfil

Cambiar el selector a **Coordinadora de enfermería**. Esto abre otra conversación y borra el hilo. Se hace una sola vez, aquí.

### Interacción 2 — Datos del equipo (perfil **Coordinadora de enfermería**), unos 11 s

```text
¿Quiénes de mi equipo están de turno de noche el sábado 26 de septiembre?
```

Qué señalar:

- Chip: «consulta de datos».
- El modelo llama `listar_empleados` (equipo enfermería) y `consultar_turnos` (2026-09-26, turno N): herramientas del servidor MCP.
- Respuesta: **Diego Andrés Barreto, Elizabeth María López y Ruth González** (3 personas).
- No aparecen las personas de recepción ni de vigilancia que también trabajan esa noche: el **perfil acota el alcance**.

Mientras espera (unos 11 s): «Esta vez no consulta la ley, consulta la base: dos herramientas MCP con filtros exactos».

Si falta un nombre o sobra alguien, se dice tal cual.

### Interacción 3 — Orden de escritura (mismo perfil), unos 16 s

```text
Ponle el turno de la mañana a Elizabeth María López el próximo domingo
```

Qué señalar, en este orden:

1. Chip: «orden de escritura». El texto del asistente invita a revisar la tarjeta y **no dice que el cambio ya está hecho**.
2. La **tarjeta**: la orden, la interpretación (empleada, turno Mañana, fecha resuelta de «próximo domingo»: 2026-10-18 si la demo es esa semana) y la tabla de acciones.
3. El **veredicto del auditor**: `observaciones`, «El 2026-10-18 es domingo: aplica recargo dominical», con el artículo 179 (chunk 193). Se explica que es un agente aparte, por A2A, que decide con reglas.
4. **Aprobar** sigue habilitado: las observaciones no bloquean. Un `rechazado` sí deshabilitaría Aprobar.

Mientras espera (unos 16 s): «Tres cosas pasan ahora: se extrae la orden, se crea una propuesta pendiente y se le pide el veredicto al auditor. Todavía no se ha escrito nada».

### Interacción 4 — Aprobar (mismo perfil)

Pulsar **Aprobar**.

Qué señalar:

- El texto de resumen que empieza por «Quedó aprobada». Los tres botones quedan deshabilitados.
- «Solo ahora se escribió, y se escribió exactamente lo que mostraba la tarjeta».

Opcional, si hay tiempo y la terminal está lista, en `psql`:

```sql
SELECT e.nombre, t.codigo, a.fecha, a.estado, a.origen
FROM asignaciones a
JOIN empleados e ON e.id = a.empleado_id
JOIN turnos t ON t.id = a.turno_id
WHERE a.origen = 'tarjeta'
ORDER BY a.fecha;
```

Se ve una fila con `origen = tarjeta`, turno `M`, la fecha del domingo y el nombre de Elizabeth María López. Si se muestra el par de preferencia:

```sql
SELECT p.estado, ap.decision, ap.usuario, pp.origen, pp.rechazada IS NULL AS sin_rechazada
FROM propuestas p
JOIN aprobaciones ap ON ap.propuesta_id = p.id
JOIN pares_preferencia pp ON pp.propuesta_id = p.id
WHERE p.orden_texto NOT LIKE '[simulador%'
ORDER BY p.decidido_en DESC
LIMIT 1;
```

Resultado esperado: `estado = aprobada`, `decision = aprobar`, `usuario = coordinador` (es la constante de la tarjeta, no el selector), `origen = aprobacion`, `sin_rechazada = t`. Precisión que hay que decir: en una **aprobación limpia** el par no tiene `rechazada`, así que no es un par DPO; los pares DPO nacen de las **correcciones y rechazos**. Si se quiere mostrar una corrección, se repite la interacción 3 y en vez de Aprobar se pulsa Corregir (se quita una fila) — solo con la demo ensayada.

Cierre de una frase: «La traza no aprueba nada. La aprobación es la tarjeta, y la fila ya está en la base».

### Si el jurado quiere ver la traza

Solo si Phoenix está arriba: abrir `http://localhost:6006`, proyecto del servicio `relevo`, y la traza nueva (no una vieja). Se ve el span `relevo.turno` (tipo AGENT) y, si el modelo respondió, `relevo.router` y `relevo.extraccion`.

## 6. Plan B

| Si pasa esto | Qué se hace |
|---|---|
| **Sin red o xAI no responde / falta `XAI_API_KEY`** | El chat no inventa: responde el stream simulado («Soy Relevo. Aún no tengo modelo conectado… configura XAI_API_KEY»). Se muestra esa burbuja, se dice qué pasó y se **pasa a la grabación** de la demo completa guardada en `docs/entrega/`. No se reintenta la misma pregunta esperando otro resultado. |
| **El auditor está caído** | La tarjeta aparece como **«sin auditar»** y no bloquea nada: está diseñado así. Se explica y se sigue con Aprobar. Para mostrar el veredicto de todos modos, el `curl` de abajo no necesita xAI. |
| **Error 500 en el modo dev** | Detener `npm run dev`, borrar la caché y reiniciar: `Remove-Item -Recurse -Force .next` y `npm run dev`. El caso conocido de OpenTelemetry en el runtime equivocado se corrigió en el commit `2c5bb71`; si reaparece, es lo primero que se prueba. |
| **Una respuesta sale distinta de lo esperado** | Se dice lo que llegó y por qué puede pasar (el modelo no es determinista). No se fuerza el discurso. |
| **El domingo no sale en la tarjeta** | Se dice qué veredicto llegó. La orden de aprobación sigue valiendo. |
| **La demo completa no se puede hacer** | La lámina 10 (3,08 → 76,92 → 83,08 → 98,46) y la lámina 11 no dependen de la red. |

Veredicto del auditor sin el asistente (PowerShell; el cuerpo es el del reporte D2):

```powershell
$body = @'
{"jsonrpc":"2.0","id":"demo-b","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"propuesta_id":"demo-domingo","orden_texto":"Ponle la mañana el domingo 4 de octubre.","extraccion":{"empleado":"Elizabeth María López","turno":"M","fechas":["2026-10-04"],"justificacion":null},"acciones":[{"tipo":"asignar_turno","empleado_id":2,"turno":"M","fecha":"2026-10-04"}],"contexto":{"solapes_detectados":[],"ausencias_en_rango":[]}}}]}}}
'@
curl.exe -sS -X POST http://127.0.0.1:8641/a2a -H "Content-Type: application/json" --data-binary $body
```

Esperado: tarea `completed` con el artefacto `veredicto_auditoria`, veredicto `observaciones` y el artículo 179. Los id de tarea y de artefacto cambian en cada llamada.

## 7. Qué no hacer

- No re-sembrar la base ni usar `docker compose down -v`.
- No abrir `.env` frente al público.
- No presentar la búsqueda de la demo como híbrida si el servicio de embeddings estaba apagado.
- No presentar las 120 filas del simulador como usuarios del curso.
- No cambiar de perfil a mitad de las interacciones 2 a 4: cambiar el selector abre otra conversación.
- No forzar un Aprobar sobre una tarjeta `rechazado`: el botón está deshabilitado y no es el camino.

## 8. Después

Cuando termine la presentación:

1. Detener los servicios: `Ctrl+C` en las terminales del auditor y la web.
2. Si se encendió Phoenix: `docker compose stop phoenix`.
3. Dejar la base lista para la próxima vez con el reseteo del paso 1.4 (borra solo lo creado por la demo).
4. Apagar la base solo si se necesita la memoria: `docker compose stop db` (nunca `down -v`).
