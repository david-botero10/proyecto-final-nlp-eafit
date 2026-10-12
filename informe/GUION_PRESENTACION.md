# Guion de la presentación — Relevo

Sustentación de SI7016 Procesamiento del Lenguaje Natural Aplicado (EAFIT, 2026-2). Equipo: Isabel Jurado Jaramillo, Alejandro Silva Zuluaga, David Botero Londoño.

Este documento es para estudiar y ensayar. Cada lámina trae lo que se dice, la teoría que hay que dominar para defenderla, las preguntas probables del jurado y un plan B. Todas las cifras salen de `informe/INFORME_FINAL.md`, `evaluacion/` y los reportes de `docs/orca/reports/`. Si una cifra no está allí, no se dice.

## Supuestos de tiempo

Se asume un turno de **20 minutos**: unos 13 de charla, 5 de demo en vivo y 1,5 de colchón para transiciones y ajuste. Las preguntas del jurado se asumen aparte; si entran dentro de los 20, se usa la variante comprimida.

El reparto de quién habla es una **sugerencia**: está pensado para que cada integrante hable unos 4 minutos y para que quien conduce la demo sea quien más tocó el sistema. Pueden cambiarlo, pero cada uno debe poder responder las preguntas de todas las láminas (ver la checklist del final).

| Lámina | Título | Minutos | Sugerido |
|---:|---|---:|---|
| 1 | Portada | 0,5 | Isabel |
| 2 | El problema | 0,75 | Isabel |
| 3 | La propuesta | 0,75 | Isabel |
| 4 | Demo en vivo | 5,0 | David conduce, Isabel lee las preguntas |
| 5 | Cómo funciona | 0,75 | Alejandro |
| 6 | Arquitectura | 1,0 | Alejandro |
| 7 | Recuperación con citas | 1,0 | Alejandro |
| 8 | Lo que medimos | 0,75 | Alejandro |
| 9 | La innovación | 1,0 | David |
| 10 | Resultados del extractor | 1,25 | David |
| 11 | Dónde actuó el DPO | 1,0 | David |
| 12 | La pregunta de investigación | 1,0 | David |
| 13 | Gobernanza | 1,0 | Isabel |
| 14 | Arquitectura de despliegue | 1,0 | David |
| 15 | Limitaciones | 0,75 | Isabel |
| 16 | Cierre | 0,5 | Isabel |

Suma: 13 minutos de charla, 5 de demo y 1,5 de transiciones y colchón. La lámina 14 (despliegue) se financia con 0,5 minutos tomados de las láminas 6 y 7 y 0,5 del colchón; la demo no se acorta.

### Variante comprimida de 12 minutos (con demo de 4)

| Qué se hace | Láminas | Minutos |
|---|---|---:|
| Fundir en un solo bloque hablado | 1, 2, 3 | 1,5 |
| Demo: las tres interacciones principales (norma, orden, aprobación). Se omite «consulta de datos» y se menciona de palabra | 4 | 4,0 |
| Se omite como lámina; se resume en una frase al empezar la arquitectura | 5 | 0 |
| Arquitectura: solo las tres piezas que importan (MCP, A2A, extractor) | 6 | 1,0 |
| Citas y cifras en un solo bloque (recall@5 100 %, MRR 0,933, 20/20 del auditor) | 7, 8 | 1,25 |
| Innovación corta | 9 | 0,75 |
| Extractor y DPO en un solo bloque (3,1 → 76,9 → 83,1 → 98,5; quitar 50 → 90) | 10, 11 | 1,5 |
| Pregunta de investigación | 12 | 0,5 |
| Gobernanza y despliegue en tres frases (todo gratuito, tres nubes, Phoenix en local) | 13, 14 | 0,75 |
| Limitaciones y cierre juntos | 15, 16 | 0,75 |

Total: 12 minutos. Lo que no se dice en la charla queda en la teoría de cada lámina para la ronda de preguntas.

### Cómo usar este documento

1. Lean la lámina y el guion hablado una vez en voz alta con cronómetro.
2. Estudien «Teoría que hay que dominar» hasta poder explicarla sin leer y con un ejemplo de Relevo.
3. Contesten en voz alta las preguntas del jurado de cada lámina.
4. Al final, usen la checklist del ensayo.

Lo que **no** se puede decir (el jurado lo va a oír como inflado):

- Que el modelo pequeño alcanza a Grok. Hoy no: 83,08 % frente a 98,46 %.
- Que el 75,83 % es aceptación de usuarios. Son 120 decisiones simuladas.
- Que hay usuarios reales. Hay cero sesiones.
- Que el despliegue es de producción. Es una demostración en planes gratuitos, con datos sintéticos, un código de acceso compartido y sin autenticación real.

---

## Lámina 1 — Portada

**Tiempo:** 0,5 min. **Quién (sugerido):** Isabel.

### Qué decir

«Buenas tardes. Somos Isabel Jurado, Alejandro Silva y David Botero, y les presentamos Relevo, nuestro proyecto final de Procesamiento del Lenguaje Natural Aplicado.

Relevo es un agente conversacional para coordinadores de turnos de pymes colombianas. Entiende cómo hablan, consulta la norma laboral citándola, y solo escribe en la nómina cuando una persona aprueba el cambio.

En los próximos minutos vemos el problema, lo ponemos a funcionar en vivo, explicamos cómo está construido, qué medimos y qué respondimos a la pregunta de investigación que nos planteamos.»

### Teoría que hay que dominar

- **Qué es un agente de LLM.** Un modelo de lenguaje que, en vez de solo generar texto, puede decidir llamar herramientas, leer el resultado y seguir. El ciclo es: el modelo recibe los mensajes y la lista de herramientas, emite una llamada a herramienta con argumentos estructurados, el programa la ejecuta, el resultado se agrega a la conversación y el modelo vuelve a ser llamado. Termina cuando responde texto sin pedir más herramientas o cuando se cumple una condición de parada (`stopWhen`). En Relevo, el Vercel AI SDK implementa ese ciclo y la condición es `stepCountIs(6)`: como máximo seis pasos por turno.
- **Principio de diseño.** Consultar es autónomo; escribir exige aprobación humana en una tarjeta estructurada. Todo el proyecto es la consecuencia técnica de esa frase.
- **Qué cubre la rúbrica.** Agente con tool use autónomo, razonamiento sobre datos externos, memoria de contexto, adaptación al perfil, RAG agéntico con búsqueda híbrida, re-ranking y citas, embeddings, clasificación, datasets públicos, aprendizaje continuo, MCP y A2A, datos estructurados y no estructurados, interfaz, evaluación y un componente prospectivo a 1–5 años.

### Preguntas probables del jurado

1. **¿Qué es lo nuevo frente a un chatbot con RAG?** Tres cosas juntas: la escritura gobernada por tarjeta (el modelo no tiene la herramienta), un segundo agente independiente que audita por A2A, y el uso de la decisión humana como dato para afinar el extractor. Cada una por separado existe; la combinación y la medición del ciclo son lo propio.
2. **¿Es un agente o un flujo fijo?** Es ambas cosas a propósito. El router clasifica la intención y orienta, pero el modelo decide qué herramientas llamar y cuántas veces. En la demo, para una pregunta de recargo nocturno, decidió llamar `buscar_norma` cuatro veces refinando la consulta. La escritura, en cambio, es deliberadamente rígida.

### Si algo falla

Nada que fallar aquí. Si el proyector no funciona, se empieza hablando con la lámina 2 de memoria.

---

## Lámina 2 — El problema

**Tiempo:** 0,75 min. **Quién (sugerido):** Isabel.

### Qué decir

«Un coordinador de turnos de una clínica, un restaurante o una empresa de vigilancia maneja horarios rotativos y una norma laboral que cambia: la Ley 2101 de 2021 y la reforma laboral de 2025 modificaron jornadas y recargos.

Un chat genérico contesta dudas, pero dejar que el modelo escriba en la nómina es inaceptable: una fecha mal entendida o una persona equivocada pasa directo a la realidad, y nadie lo ve a tiempo. Y si volvemos a hacerlo todo a mano, el agente no aporta nada.

Esa es la tensión. Nuestra respuesta es una regla simple: consultar es autónomo; escribir exige la aprobación de una persona.»

### Teoría que hay que dominar

- **Por qué el español coloquial es difícil.** «Ponle el de la mañana a Doris toda la otra semana» mezcla un alias, un turno por su nombre común y una fecha relativa que depende del día de hoy. Resolverla es extracción de información estructurada (entidades, turno, rango de fechas, acción) con razonamiento temporal. Las fechas se resuelven contra «hoy» en `America/Bogota`.
- **Datos estructurados y no estructurados.** La nómina (turnos, ausencias, empleados) es estructurada: tablas, filtros exactos, SQL. La norma es no estructurada: texto legal que se recupera por significado. Relevo tiene las dos en un solo PostgreSQL con pgvector.
- **Caso simulado.** Clínica ficticia con 40 empleados en tres equipos: enfermería (20), recepción (10), vigilancia (10). La nómina sintética tiene 1 837 asignaciones y 30 ausencias, con 0 solapes con ausencias aprobadas.
- **Ética de datos sintéticos.** Todo dato de empleados es ficticio: Faker `es_CO`, semilla 42. La razón: los datos laborales son datos personales y, en Colombia, su tratamiento está regulado (Ley 1581 de 2012; esto es contexto general, no una cifra del informe). Usar datos sintéticos evita ese riesgo y permite compartir el repositorio. Su costo: la distribución es la que nosotros generamos, así que mide generalización a plantillas no vistas, no la variedad del lenguaje real de coordinadores.

### Preguntas probables del jurado

1. **¿Por qué no dejar que el modelo escriba si es bueno?** Porque el costo de un error no es simétrico: una respuesta mala se corrige leyendo; una escritura mala cambia una nómina. Incluso Grok 4.7, con 98,46 % de exactitud total, falla 1 de cada 65 órdenes. La tarjeta convierte ese error en algo visible antes de que ocurra.
2. **¿Por qué datos sintéticos? ¿No invalida la evaluación?** No la invalida, la acota. Mide qué tan bien el sistema generaliza a plantillas de órdenes que no vio (el test no comparte moldes con el entrenamiento), no cuánto se parece al lenguaje real. Lo decimos en las limitaciones y el protocolo de sesiones con usuarios ya está escrito.

### Si algo falla

Nada.

---

## Lámina 3 — La propuesta

**Tiempo:** 0,75 min. **Quién (sugerido):** Isabel.

### Qué decir

«Relevo tiene tres capacidades y un solo principio.

Primera: entiende cómo habla el coordinador. “Ponle el de la mañana a Ana toda la otra semana” se convierte en empleado, turno y fechas exactas.

Segunda: responde con la norma citada. Indexamos el Código Sustantivo del Trabajo y las leyes 2101 y 2466, y cada afirmación normativa lleva su artículo.

Tercera: propone, no impone. Cada cambio llega en una tarjeta que muestra exactamente lo que se va a escribir. La nómina cambia solo cuando alguien aprueba.

Antes de explicar cómo funciona por dentro, se lo mostramos.»

### Teoría que hay que dominar

- **Clasificación de intención (router).** Cada mensaje se clasifica en `charla`, `consulta_datos`, `consulta_norma` u `orden_escritura`. Se hace con `generateObject` del AI SDK y un esquema Zod: `{intencion: enum, confianza: número entre 0 y 1, razon: texto}`. Salida estructurada significa que el modelo debe producir un JSON que cumpla el esquema y el SDK lo valida; si no cumple, el parseo falla y el flujo cae a `charla` sin bloquear la respuesta. El resultado se antepone al system prompt como guía y se muestra como chip en la interfaz. No bloquea herramientas: es una guía, no una compuerta.
- **Por qué un router y no solo dejar al modelo.** Observabilidad (queda en la traza), UX (el chip), y orientar al modelo en la intención más delicada (`orden_escritura`). Alternativa documentada en la arquitectura: moverlo a un clasificador afinado. No lo hicimos.
- **Fuentes del corpus.** Código Sustantivo del Trabajo (18 páginas HTML del Senado), Ley 2101 de 2021 y Ley 2466 de 2025 (Función Pública). 20 documentos y 589 chunks. Las cartillas del Ministerio del Trabajo no se pudieron descargar: el corpus es de leyes. Si preguntan, se dice.

### Preguntas probables del jurado

1. **¿Por qué solo esos documentos?** Cubren jornada, recargos, descansos y dominicales, que es lo que el auditor y las preguntas doradas necesitan. Faltan las cartillas con ejemplos numéricos en lenguaje llano; A3 documenta los siete intentos de descarga fallidos.
2. **¿La norma está vigente?** El corpus es el texto que descargamos en septiembre de 2026. Cada chunk guarda fuente, referencia y URL; no hay un mecanismo automático de vigencia. Hay una discrepancia que dejamos explícita: el auditor aplica 44 horas (Ley 2101) y el artículo 161 indexado tras la Ley 2466 habla de 42 como meta. Es una decisión consciente documentada, no un descuido.

### Si algo falla

Nada.

---

## Lámina 4 — Demo en vivo

**Tiempo:** 5 min. **Quién (sugerido):** David conduce el teclado; Isabel lee cada pregunta en voz alta y señala la pantalla. El runbook paso a paso está en `informe/GUION_DEMO.md`.

### Qué decir

La demo corre sobre la URL pública del despliegue (con el código de acceso), con el sistema local como plan B (ver «Si algo falla»). Se habla poco; se narra mientras el sistema trabaja. Texto base:

«Cuatro conversaciones, un coordinador.

Primera, perfil Gerencia: “¿Cuánto me pagan de recargo si trabajo de noche?”. Fíjense en el chip: consulta de norma. El modelo decide buscar, y aquí lo vemos buscando varias veces y refinando la consulta. La respuesta dice 35 % de recargo y cita el artículo 168 del Código, con el 169 como base y el 134 para el pago. Abajo, el panel de fuentes, con enlace.

Segunda, cambio a Coordinadora de enfermería: “¿Quiénes de mi equipo están de turno de noche el sábado 26 de septiembre?”. Consulta de datos: llama herramientas del servidor MCP y responde con tres personas de enfermería, no con las de recepción ni vigilancia que también trabajan esa noche. El perfil acota el alcance.

Tercera, una orden: “Ponle el turno de la mañana a Elizabeth María López el próximo domingo”. No se escribe nada. Aparece una tarjeta con el domingo 18 de octubre resuelto, y el auditor, un agente aparte que habla A2A, ya la revisó: observa que es domingo y cita el artículo 179.

Cuarta, aprobamos. Solo ahora se escribe, con origen “tarjeta”, y la decisión queda guardada.»

### Teoría que hay que dominar

- **RAG agéntico.** En un RAG clásico, siempre se recupera y luego se genera. En el agéntico, el modelo **decide si, cuándo y qué recuperar**; puede reformular la consulta y volver a buscar. En la interacción 1 llamó `buscar_norma` cuatro veces. Se ve en el indicador «consultando norma…». Una pregunta como «¿cuántos turnos tiene Ruth?» no dispara `buscar_norma`.
- **Tool calling.** Las herramientas (`listar_empleados`, `consultar_turnos`, `consultar_ausencias`, `buscar_norma`, `crear_propuesta`) se describen al modelo con nombre, descripción y esquema de entradas (Zod, convertido a JSON Schema). El modelo no ejecuta nada: devuelve la intención de llamar con argumentos, y nuestro código la ejecuta. Por eso podemos negarle una herramienta: `ejecutar_propuesta` no está en la lista.
- **Memoria y perfil.** El historial vive en `conversaciones` y `mensajes`; el id de la conversación está en `localStorage` y el historial se reinyecta al reabrir. El perfil (rol y equipo) se inyecta al system prompt **y** se aplica en código: filtra `listar_empleados`, turnos y ausencias, y rechaza propuestas de otro equipo. Cambiar el selector abre otra conversación.
- **Datos estructurados vs. no estructurados en una sola demo.** Interacción 1 es no estructurada (texto legal por significado). Interacción 2 es estructurada (SQL parametrizado vía MCP). La 3 y la 4 son acciones sobre datos estructurados con control.
- **Extracción de la orden.** «Próximo domingo» se resuelve a 2026-10-18 contra la fecha de hoy en Bogotá. Se hace con `generateObject` y un esquema (empleado, turno `M`/`T`/`N`, fechas ISO, justificación, acción). Si `EXTRACTOR_URL` tiene valor se llama primero al extractor propio y, si falla, a Grok. En la demo, la extracción la hace Grok.
- **Desambiguación.** «Elizabeth» a secas coincide con dos personas (enfermería y vigilancia), así que el agente pide aclarar. Es un comportamiento deseado.

### Preguntas probables del jurado

1. **¿Por qué tardó tanto la primera pregunta (unos 25 s)?** Porque el modelo hizo cuatro llamadas a `buscar_norma` y cada una es una vuelta al modelo. Es el costo del RAG agéntico: más calidad en la consulta, más latencia. El tope de seis pasos lo acota.
2. **¿La búsqueda era híbrida en la demo?** Depende de cómo se ensayó. En la corrida de verificación del 12 de octubre, el servicio de embeddings estaba apagado por memoria (quedaban unos 2,5 GB libres de 15,7 GB), la búsqueda cayó a modo léxico y la respuesta fue correcta de todos modos. Las cifras de recuperación (100 % en top 5) son del modo híbrido, medido aparte. Hay que decirlo con esas palabras si lo preguntan; no se presenta la demo léxica como la híbrida. En la nube, el servicio de embeddings de Modal se mantiene tibio y la búsqueda debería ser híbrida; se verifica en el chip de la respuesta antes de afirmarlo.
3. **¿Qué pasa si el usuario se equivoca de equipo?** Una coordinadora de enfermería no puede proponer un cambio para otro equipo: el backend rechaza la propuesta. Gerencia no se recorta.
4. **Al aprobar, ¿qué par de preferencia se crea?** En una aprobación limpia, el par tiene `elegida` = la extracción y `rechazada` = nulo (origen `aprobacion`). Eso no es un par DPO; solo las correcciones y rechazos, que tienen `rechazada`, lo son. La diapositiva dice «nace un par»; la precisión es esa.

### Si algo falla

- Plan B general: si la URL pública no responde o falla una interacción, pasar al sistema local (runbook en `informe/GUION_DEMO.md`) y decirlo con calma: es la misma aplicación. Dejar el local levantado y ensayado antes de entrar.
- Sin red o sin clave de xAI: el chat responde el stream simulado («configura XAI_API_KEY»). Pasar al video grabado de la demo (`docs/entrega/`) y explicar que es una grabación.
- Auditor caído: la tarjeta sale «sin auditar» y no bloquea. Es un comportamiento de diseño; se explica así.
- Error 500 en modo dev: borrar `.next` y reiniciar. Ver el runbook.

---

## Lámina 5 — Cómo funciona

**Tiempo:** 0,75 min. **Quién (sugerido):** Alejandro.

### Qué decir

«Lo que vieron es este recorrido en cinco pasos. El coordinador escribe la orden como habla. La extracción, hecha por Grok o por nuestro extractor afinado, la convierte en un JSON con empleado, turno y fechas. Antes de mostrar nada, un segundo agente, el auditor, la revisa por A2A: que la persona exista, que no haya solapes, que se respete la jornada, y que se señalen domingos y festivos. La tarjeta muestra el cambio exacto con el veredicto. Y solo con la aprobación humana se escribe, en una transacción, guardando además la decisión como dato de entrenamiento.

La clave es que cada paso tiene un dueño distinto, y el que escribe no es el modelo.»

### Teoría que hay que dominar

- **Separación de funciones en un sistema multiagente.** El asistente conversa, extrae y propone. El auditor verifica. El humano decide. El backend ejecuta. Ninguno hace el trabajo del otro. El principio viene de control interno (quien propone no aprueba) y se aplica a agentes.
- **El auditor decide por reglas, no por LLM.** Veredicto `rechazado` si el empleado no existe o no está activo, o si hay solape duro (otro turno el mismo día, turno dentro de una ausencia aprobada, ausencia que pisa turnos activos). `observaciones` si hay domingo, festivo, turno de noche, más de 6 días, más de 44 horas o la semana queda al límite. `aprobado` si todo pasa. Un LLM solo puede **redactar** las razones (si hay clave y no es un test); no puede cambiar el veredicto. La razón de ese diseño es auditabilidad y determinismo: dos corridas con la misma propuesta dan el mismo veredicto.
- **Por qué `observaciones` no bloquea.** Un séptimo día o un domingo son legales con recargo; la persona decide con información. Solo el solape duro y el empleado inválido bloquean (Aprobar queda deshabilitado). Es una decisión de producto, no un fallo.
- **Transacción.** Aprobar escribe asignaciones o ausencias, registra la aprobación, crea el par de preferencia y actualiza el estado de la propuesta en **una sola transacción**: o ocurre todo o no ocurre nada.
- **La tarjeta es el permiso.** Aprobar aplica las `acciones` congeladas en la propuesta, no vuelve a interpretar la orden. Lo que muestra la tarjeta es exactamente lo que se escribe.

### Preguntas probables del jurado

1. **¿Qué pasa si el auditor cae?** La tarjeta aparece como «sin auditar» y la conversación sigue: el cliente A2A devuelve `null` al vencer `AUDITOR_TIMEOUT_MS` (8 s por defecto). Elegimos fallar abierto en la auditoría porque la compuerta real es la persona; es un compromiso, y si la política fuera más estricta se cambiaría a fallar cerrado.
2. **¿Y si el humano aprueba sin leer?** Es el riesgo clásico de humano en el lazo («fatiga de aprobación»). Lo mitigamos con la tarjeta compacta, el veredicto visible y los bloqueos duros. No lo medimos; las sesiones con usuarios lo harían.
3. **¿Por qué el extractor corre antes del auditor?** Porque el auditor revisa la propuesta ya estructurada: necesita empleado, turno y fechas concretas para aplicar reglas.

### Si algo falla

Nada específico; si se pregunta por el auditor y no se puede mostrar, se enseña la Agent Card con `curl` (runbook).

---

## Lámina 6 — Arquitectura

**Tiempo:** 1,25 min. **Quién (sugerido):** Alejandro.

### Qué decir

«Arriba, el camino de una conversación: el chat web en Next.js con el AI SDK de Vercel, el asistente con Grok 4.7, que primero clasifica la intención y luego usa herramientas, el servidor MCP propio y PostgreSQL, que guarda la nómina sintética y el corpus legal con embeddings bge-m3 en pgvector. El servidor MCP expone cinco herramientas: cuatro de lectura y una que crea propuestas. La escritura no es una de ellas.

Abajo, tres piezas de apoyo. El auditor, un agente independiente que publica su Agent Card y habla A2A. El extractor propio, un Qwen3.5 de 0,8 mil millones de parámetros afinado con QLoRA y DPO, que cabe en una GPU de 8 gigas. Y la observabilidad: OpenTelemetry y Arize Phoenix, donde cada turno es una traza.

Usamos dos protocolos abiertos con roles distintos: MCP es el contrato con los datos; A2A es el contrato entre agentes.»

### Teoría que hay que dominar

- **MCP (Model Context Protocol).** Protocolo abierto cliente–servidor sobre JSON-RPC. El servidor publica herramientas con nombre, descripción, esquema JSON de entrada y anotaciones (`readOnlyHint`, `destructiveHint`). El cliente las descubre y las llama. Ventajas frente a funciones ad hoc: el contrato es independiente del orquestador (el mismo servidor sirve al asistente y al auditor), las herramientas son descubribles y tipadas, y se puede cambiar el cliente (otro host o modelo) sin reescribir las herramientas. En nuestro chat, el cliente y el servidor se conectan con un par `InMemoryTransport` dentro del servidor de Next; con `npm run mcp` el mismo servidor corre por stdio. El contrato es el mismo. Las cuatro herramientas de lectura llevan `readOnlyHint: true`; `crear_propuesta` lleva `readOnlyHint: false` y `destructiveHint: false`, e inserta una propuesta pendiente sin tocar nómina.
- **A2A (Agent2Agent).** Protocolo abierto para que agentes opacos de distintos proveedores se descubran y colaboren. El agente publica una **Agent Card** (`GET /.well-known/agent.json`) con nombre, URL, capacidades y skills. El cliente envía `message/send` (JSON-RPC) con un mensaje compuesto por partes; el servidor responde una **tarea** con estado (`completed`) y **artefactos** (aquí, `veredicto_auditoria`). Diferencia con MCP: MCP conecta un agente con herramientas y datos; A2A conecta agentes entre sí. Nuestra implementación es un subconjunto sin SDK: Agent Card, `message/send`, tarea completada y artefacto; `tasks/get` responde `-32001` («no persistido») y no hay streaming. Se dice «subconjunto del protocolo», no «implementación completa».
- **Por qué dos agentes y no uno.** Independencia: el auditor corre en otro proceso, con su propio rol de base de datos de solo lectura (`SET ROLE relevo_lector`) y reglas deterministas; no comparte el contexto ni el prompt del asistente, así que no hereda sus errores. Reemplazable: cualquier proceso que hable el mismo `message/send` sirve.
- **Frameworks de orquestación.** No usamos LangGraph ni CrewAI. El ciclo de herramientas del AI SDK (`streamText` con `tools` y `stopWhen`) basta para un asistente con un router y seis pasos. Es una decisión de simplicidad, no una ausencia de conocimiento.
- **Una sola base.** PostgreSQL 17 + pgvector guarda filas y vectores. Evita operar una base vectorial aparte y permite una consulta híbrida sin infraestructura adicional. SQL explícito (`postgres-js`, `psycopg`), sin ORM, para que cada herramienta sea una consulta auditable.
- **Grok 4.7.** Frontera en tool use. La propuesta planteó 4.6; el modelo pasó a 4.7 al mismo precio (commit `2b15c75`). `RELEVO_MODELO` lo cambia.

### Preguntas probables del jurado

1. **¿Por qué MCP si la herramienta corre en el mismo proceso?** Porque el contrato importa más que el transporte. Hoy el par en memoria evita un proceso aparte; mañana el mismo servidor se expone por stdio o HTTP sin cambiar las herramientas, y el auditor ya lo consume como cliente independiente.
2. **¿Por qué A2A y no una llamada HTTP normal?** Una llamada HTTP propia también funcionaría. A2A aporta descubrimiento (la Agent Card), un formato estándar de mensajes y tareas y la posibilidad de cambiar el auditor por otro de otro proveedor sin tocar el chat. El curso lo pide como estándar de interoperabilidad. La honestidad: es un subconjunto simple y el beneficio de interoperabilidad hoy es potencial, no demostrado con un tercero.
3. **¿Por qué no usaron un framework de agentes?** Complejidad innecesaria para este flujo. Un solo agente con herramientas, un router y un auditor externo se resuelve con el SDK. Si hubiera planificación con ramificaciones, valdría la pena un grafo de estados.
4. **¿Qué pasa si Grok cambia o desaparece?** `RELEVO_MODELO` cambia el modelo; el extractor propio ya funciona como alternativa para la extracción, aunque no para la conversación.

### Si algo falla

Si se cae el proyector con el diagrama, se dibuja en la pizarra: UI → router → asistente ↔ MCP ↔ PostgreSQL; asistente ↔ auditor por A2A.

---

## Lámina 7 — Recuperación con citas

**Tiempo:** 1,25 min. **Quién (sugerido):** Alejandro.

### Qué decir

«Medimos la recuperación con veinte preguntas escritas como las haría un coordinador, no como dice la ley. Con búsqueda híbrida, el artículo esperado aparece el 100 % de las veces entre los cinco primeros resultados, y el MRR es 0,933: casi siempre sale primero.

Además usamos a Grok 4.7 como juez de fidelidad: el 92,6 % de las afirmaciones de las respuestas están respaldadas por el fragmento citado. Y lo decimos con cautela: el juez es de la misma familia que el asistente.

El contraste importa: buscando solo por palabras, el recall cae a 12,5 %, porque la ley dice “recargo nocturno” y el usuario dice “cuánto me pagan de noche”. La parte semántica marca la diferencia.»

### Teoría que hay que dominar

**Embeddings densos.** Un embedding es un vector de números reales que representa el significado de un texto; textos con significado parecido quedan cerca en el espacio. Se obtiene con un modelo entrenado de forma contrastiva (acercar pares relacionados, alejar los demás). `bge-m3` (BAAI; Chen et al., 2024) es multilingüe, de código abierto, soporta textos largos y corre en CPU. Usamos su salida **densa** de **1 024 dimensiones**, normalizada a norma 1. Con vectores normalizados, la similitud coseno es el producto punto; en pgvector, `<=>` es la distancia coseno (1 − similitud). La consulta del usuario se convierte en un vector con el mismo modelo, y se buscan los chunks más cercanos.

**Índice HNSW.** Buscar el vecino más cercano exacto compara con todos los vectores. HNSW (Hierarchical Navigable Small World) es un índice aproximado: un grafo en capas donde las capas altas son escasas y permiten saltos largos, y las bajas son densas. La búsqueda baja de capa en capa acercándose al objetivo con recorrido voraz. Cambia exactitud por velocidad (parámetros de construcción y de búsqueda). Con 589 chunks, una búsqueda exacta bastaría; el índice HNSW (`vector_cosine_ops`) es la configuración que escala y la que pide la arquitectura.

**Búsqueda léxica.** `tsvector` convierte el texto en lexemas: con la configuración `spanish` se eliminan palabras vacías y se reduce cada palabra a su raíz (stemming: «nocturno», «nocturnos» → raíz común); `unaccent` quita tildes para que «jornada» y «jornáda» coincidan. `websearch_to_tsquery` interpreta la consulta del usuario como una búsqueda tipo web; `ts_rank_cd` ordena por densidad de cobertura. Es excelente con términos exactos («art. 168», «dominical») y falla con **desajuste de vocabulario**: si el usuario no usa las palabras de la ley, no hay coincidencia. En el análisis léxico de B2, «trabajo nocturno porcentaje» no devolvió resultados.

**Búsqueda híbrida y RRF.** Se corren las dos ramas en paralelo (30 mejores de cada una) y se fusionan con **Reciprocal Rank Fusion**:

`puntaje(d) = Σ 1 / (k + rango_i(d))`, con `k = 60`

donde la suma recorre las listas en las que aparece el documento y el rango empieza en 1. Ejemplo: un chunk que es primero en el vector (1/61) y tercero en el léxico (1/63) suma ≈ 0,0323. El máximo posible con dos listas es 2/61 ≈ 0,0328, por lo que los puntajes de 0,03 en el humo de C1 son típicos. **Por qué funciona sin normalizar:** el puntaje de `ts_rank_cd` y la distancia coseno viven en escalas incomparables; RRF solo usa posiciones, que sí son comparables. `k` suaviza: evita que el puesto 1 domine de forma desproporcionada sobre el 2 o el 3, y premia lo que aparece en ambas listas. El valor 60 viene del artículo original de Cormack et al. (2009) y es el valor estándar; no lo ajustamos.

**Re-ranking.** Un *bi-encoder* (bge-m3) codifica consulta y documento por separado: es rápido y permite precalcular y indexar. Un *cross-encoder* (`BAAI/bge-reranker-v2-m3`) procesa consulta y documento juntos con atención cruzada, y es más preciso pero no se puede indexar: cuesta una pasada del modelo por cada par. Por eso se aplica solo a los 20 mejores tras RRF. En Relevo es **opcional**: si `POST /rerank` responde 200, reordena; si no, queda el orden de RRF. En el humo de C1 respondió 501 (modelo no en caché), así que esas cifras son de RRF sin re-ranker.

**Fragmentación (chunking) por artículo.** Un chunk es un artículo de ley, con parte, título y capítulo antepuestos como contexto. Razón: el artículo es la unidad de significado jurídico y de cita (`ref = art. 168`). Si un artículo supera 1 200 tokens se parte en ventanas de 1 200 con solape de 100 para no cortar ideas. Fragmentar por tamaño fijo habría mezclado artículos y vuelto imprecisa la cita.

**Citas y alucinación.** La alucinación es generar contenido que suena plausible y no está respaldado. Un RAG reduce el riesgo anclando la respuesta en texto recuperado, y la cita permite que la persona verifique. No lo elimina: el modelo puede afirmar más de lo que dice el fragmento. Por eso el guardrail añade «Esta respuesta no cita la norma; verifícala» si una respuesta normativa no trae `[n]` ni llamó a `buscar_norma`, y por eso medimos fidelidad.

**Métricas de recuperación.**

- **recall@k:** de los artículos esperados para una pregunta, la fracción que aparece en los k primeros resultados; se promedia sobre las preguntas (macro). Aquí: @3 97,5 %, @5 100 %, @8 100 %.
- **MRR (Mean Reciprocal Rank):** `MRR = (1/|Q|) Σ 1/rango_i`, donde `rango_i` es la posición del primer artículo esperado (si no aparece en 8, aporta 0). Aquí 0,933: 18 preguntas con el artículo en primer lugar y 2 en tercer lugar (c16 y c20, 0,333 cada una): (18 + 2·0,333)/20 = 0,933.
- La coincidencia es por **número de artículo**: un «art. 22» de otra ley también cuenta. Es una limitación del cotejo.

**Fidelidad con juez LLM.** Un modelo recibe la respuesta y los fragmentos citados y marca cada afirmación como respaldada o no; la fidelidad es la fracción respaldada. Media 0,926 (16 de 20 preguntas en 1,000; mínimo 0,500 en c02). **Sesgos:** (1) el juez es Grok 4.7, la misma familia que el asistente, y los jueces LLM tienden a favorecer texto generado por modelos parecidos a ellos (autopreferencia) y a ser indulgentes; no es un evaluador independiente. (2) Son solo 20 preguntas. (3) La fidelidad baja no coincide con la recuperación débil: c02, c03, c04 y c12 tenían el artículo en el top 3 pero la respuesta afirmaba más de lo respaldado; c16, c18 y c20, flojas en recuperación, tienen 1,000. El hueco está en lo que dice la respuesta, no en encontrar el artículo. Mitigaciones posibles: un segundo juez de otra familia, o una muestra revisada a mano.

**El 12,5 % léxico.** Viene de una primera corrida de F1 (recall 12,5 %, MRR 0,150) que **no quedó en el JSON versionado**: `evaluacion/resultados/citas.json` tiene 20 filas híbridas y 0 léxicas, y el informe final decidió no citarla. La lámina la muestra. Si el jurado pide el soporte, la respuesta honesta es: «fue una primera corrida; la corrida versionada es solo híbrida; el contraste puntual reproducible es el de B2, donde “trabajo nocturno porcentaje” no devuelve nada en léxico». Alternativa limpia antes de la sustentación: correr `npm run eval:citas` con el servicio de embeddings apagado para obtener la columna léxica y versionarla.

### Preguntas probables del jurado

1. **¿Por qué RRF y no sumar los puntajes?** Porque los puntajes no son comparables: uno es una similitud de coseno y otro un rango de cobertura de `tsvector`. RRF solo usa posiciones, no requiere normalizar ni calibrar, tiene un único parámetro y es robusto. La alternativa es una combinación lineal ponderada con normalización min–max, que depende de cada consulta y exige elegir pesos.
2. **¿Por qué no solo embeddings?** Los embeddings densos pueden fallar con identificadores exactos como «art. 179» y con términos poco frecuentes; la rama léxica los captura. La híbrida cubre ambos fallos. No hicimos el ablation «solo denso», así que no afirmamos cuánto aporta cada rama por separado, solo que el solo-léxico sufre.
3. **¿Cómo sabemos que el juez no se favorece a sí mismo?** No lo sabemos; no lo medimos. Es una limitación declarada: mismo modelo, 20 preguntas. Lo que sí observamos es que el juez no puntúa 1,000 a todo (c02 = 0,500), lo que indica que no es plenamente complaciente.
4. **¿100 % de recall@5 no es sospechoso?** Son 20 preguntas escritas por nosotros y el corpus es de 589 chunks; es un techo fácil de tocar. No lo presentamos como rendimiento general, sino como evidencia de que la recuperación híbrida funciona en este dominio acotado. El MRR de 0,933 y los dos casos en tercer lugar muestran dónde se pierde.
5. **¿Por qué bge-m3?** Multilingüe fuerte en español, código abierto, 1 024 dimensiones, corre en CPU y soporta textos largos. No necesita GPU, que se reserva para el entrenamiento.

### Si algo falla

Si el servicio de embeddings no está corriendo en la demo, la búsqueda cae a léxico y la respuesta sigue funcionando. Se dice de frente y se señalan las cifras de la lámina como medidas en modo híbrido.

---

## Lámina 8 — Lo que medimos

**Tiempo:** 0,75 min. **Quién (sugerido):** Alejandro.

### Qué decir

«Cuatro cifras de la entrega final. Primera: el auditor acertó el veredicto en los veinte escenarios diseñados para engañarlo: empleados inexistentes, solapes, el festivo trasladado, una noche que termina en domingo. Segunda: el corpus tiene 589 fragmentos del Código y de las leyes 2101 y 2466. Tercera: 156 pruebas automáticas en verde, 102 de TypeScript y 54 de Python. Y cuarta: 75,8 % de las tarjetas se aprobaron sin corrección, pero ojo: son 120 decisiones simuladas, no de usuarios reales. Lo retomamos en las limitaciones.»

### Teoría que hay que dominar

- **Auditor 20/20.** Diez escenarios de la ola D2 más diez trampas nuevas de F1. Matriz de confusión diagonal: aprobado 3, observaciones 9, rechazado 8. **Lectura honesta:** el auditor es determinista y las etiquetas las escribimos nosotros con las mismas reglas; 20/20 prueba que el auditor **cumple sus reglas** en estos casos, no que un humano independiente haya etiquetado. `evaluacion/auditor.md` lo advierte.
- **Casos interesantes que hay que saber contar:** festivo trasladado (Reyes Magos, lunes 12 de enero de 2026, ley Emiliani) frente al 6 de enero que **no** es festivo ese año; noche del sábado que amanece en domingo; ausencia que cruza dos semanas; semana de 48 horas; dos turnos el mismo día en una propuesta.
- **Pruebas automáticas.** 156 = 102 (Vitest, TypeScript) + 54 (pytest, Python). Los gates son `npm run lint`, `npm test`, `npm run build`.
- **Tasa de aprobación del simulador.** 91 aprobadas de 120 = 75,83 %; 29 corregidas; 0 rechazos. El simulador pasó 120 órdenes nuevas por el extractor v1 y las etiquetó comparándolas contra el valor esperado del generador. No es aceptación de usuarios: es la tasa con la que v1 acertó contra una etiqueta conocida. Humanos: 0 filas.
- **Qué es lo medido y qué no.** Medido: extracción (n = 65), citas (n = 20), auditor (n = 20), aprobación simulada (n = 120). No medido: usuarios reales, latencia de punta a punta de forma sistemática, costo por orden, robustez a inyección de instrucciones.

### Preguntas probables del jurado

1. **¿Por qué el auditor no puede equivocarse si es 20/20?** Puede. Un conjunto de 20 casos que nosotros diseñamos estima el cumplimiento de las reglas sobre ese conjunto y nada más. No cubre festivos de otros años ni reglas que olvidamos.
2. **¿Qué significa 75,83 %?** Que en 120 órdenes simuladas, el extractor v1 coincidió con la etiqueta del generador en 91. No es tasa de aceptación humana.
3. **¿Cuántas de las 156 pruebas tocan el LLM?** Las pruebas no llaman a la red: el modelo se sustituye por funciones simuladas (`generar` inyectable). Por eso la calidad del modelo se mide aparte, en `evaluacion/`.

### Si algo falla

Nada.

---

## Lámina 9 — La innovación

**Tiempo:** 1 min. **Quién (sugerido):** David.

### Qué decir

«Este es nuestro componente de innovación: la aprobación humana como dato de entrenamiento. En un sistema con una persona en el lazo, cada tarjeta decidida es una señal de preferencia que normalmente se pierde. Relevo la guarda como un par: la extracción que la persona eligió, contra la que rechazó o corrigió.

Con esos pares hacemos un ajuste DPO incremental sobre el adaptador LoRA, sin reentrenar desde cero, y medimos el antes y el después con el mismo conjunto de prueba congelado. Nadie etiqueta aparte: la operación diaria produce los datos con los que el modelo propio mejora.»

### Teoría que hay que dominar

- **Aprendizaje continuo desde la interacción.** La rúbrica lo pide y propone «lifelong learning» como línea prospectiva. En Relevo es un ciclo **por lotes**: se acumulan decisiones, se exportan los pares y se reentrena el adaptador cuando hay suficientes. No es aprendizaje en línea: los pesos no cambian durante la conversación.
- **Pares de preferencia.** Una tupla `(prompt, chosen, rejected)`. En una corrección: `prompt` = la orden, `rejected` = la extracción original del modelo, `chosen` = la extracción corregida por la persona. Se guarda en `pares_preferencia` con `origen` (`aprobacion`, `correccion`, `rechazo`). Solo los que tienen `rechazada` no nula sirven para DPO: 29 de las 120 decisiones simuladas.
- **Ciclo completo:** tarjeta → decisión → par → DPO → medición → servicio (`POST /extraer`) → la app usa v2 y, si falla, cae a Grok.
- **Fine-tuning frente a prompting.** Prompting: se describe la tarea y se dan ejemplos en cada llamada; no cambia pesos, cuesta tokens en cada petición, depende de un modelo grande, y los datos viajan a la API. Fine-tuning: la tarea queda incorporada en los pesos de un modelo pequeño que corre local; hay costo de datos y entrenamiento, y riesgo de sobreajuste. Nuestra medición: el prompting con Grok 4.7 gana en exactitud (98,46 %); el modelo afinado gana en control, privacidad y costo marginal (no medido).
- **Por qué es innovación y no solo ingeniería.** Cierra un ciclo demostrativo de punta a punta con evaluación pre/post y hace una pregunta prospectiva medible (lámina 12).

### Preguntas probables del jurado

1. **¿Es real el aprendizaje continuo si las decisiones son simuladas?** El mecanismo es real y está instrumentado de punta a punta: una tarjeta corregida produce una fila en `pares_preferencia`, el exportador la convierte al formato de TRL, el DPO la usa y el resultado se mide contra un test congelado. La **señal** es simulada y está etiquetada (`usuario = simulador`), y es una señal idealizada: las correcciones salen de la etiqueta del generador, sin ruido humano. Lo que demostramos es el pipeline y su efecto direccional; lo que no demostramos es cuánto aprenderían de personas reales.
2. **¿No hay riesgo de que el modelo se degrade con el tiempo?** Sí: un ajuste incremental puede olvidar lo anterior o sobreajustar a pocos pares. Por eso se mide siempre contra el mismo test congelado (regresión entre versiones). En v2 los campos que ya estaban en 100 % se mantuvieron.
3. **¿Por qué no entrenar de nuevo con todos los datos?** El ajuste incremental es más barato y es lo que la rúbrica llama aprendizaje sin reentrenar desde cero. La alternativa sería mezclar pares nuevos con el dataset original; no la comparamos.

### Si algo falla

Nada.

---

## Lámina 10 — Resultados del extractor

**Tiempo:** 1,25 min. **Quién (sugerido):** David.

### Qué decir

«Medimos la exactitud total: el JSON completo tiene que estar bien, no solo un campo. El modelo base, de 0,8 mil millones de parámetros, arranca en 3,1 %. Con QLoRA, en nuestra GPU de 8 gigas, sube a 76,9 %, y con el ciclo DPO a 83,1 %. Grok 4.7, el modelo de frontera, llega a 98,5 %.

Son 65 órdenes con plantillas que el modelo nunca vio. Los intervalos de confianza al 95 % por bootstrap son de 73,9 a 90,8 para nuestro v2 y de 95,4 a 100 para Grok. No se solapan: la diferencia es real, no ruido del remuestreo.»

### Teoría que hay que dominar

**El modelo y el entrenamiento.**

- **Qwen3.5-0.8B** (Qwen/Qwen3.5-0.8B): el instruct más pequeño de su familia en Hugging Face a marzo de 2026. En Windows corrió con el fallback de PyTorch para su capa híbrida (Gated DeltaNet), porque no están `causal_conv1d` ni `flash-linear-attention`: es correcto y más lento.
- **LoRA (Low-Rank Adaptation).** En vez de actualizar la matriz de pesos `W` (d × k), se congela y se aprende una actualización de bajo rango: `W' = W + (α/r)·B·A`, con `B` (d × r) y `A` (r × k), y `r` mucho menor que d y k. `B` se inicializa en cero para que el modelo arranque idéntico al base. Parámetros entrenables: `r·(d + k)` en vez de `d·k`. Ejemplo ilustrativo con d = k = 1 024 y r = 16: 32 768 frente a 1 048 576, un 3 %. (No son las dimensiones reales de Qwen; sirve para la intuición.) Nuestros valores: `r = 16`, `α = 32` (el factor `α/r = 2` escala la actualización), dropout 0,05.
- **QLoRA.** LoRA sobre un modelo base **cuantizado a 4 bits**: los pesos congelados se guardan en NF4 (NormalFloat de 4 bits, cuyos niveles se diseñaron para pesos con distribución aproximadamente normal), con **doble cuantización** (se cuantizan también las constantes de cuantización para ahorrar más memoria). Al calcular, se desencuantiza por bloques a `bfloat16`; el gradiente fluye a través de los pesos congelados hacia los adaptadores, que sí se entrenan en mayor precisión (`bf16`). El artículo original añade **optimizadores paginados** para evitar picos de memoria; nosotros usamos **AdamW de 8 bits** (`adamw_8bit`) además de gradient checkpointing, lote 1 con acumulación de 8 (lote efectivo 8) y longitud máxima 1 536. Pico medido de memoria en el entrenamiento: 2 871,62 MiB (una RTX 4060 Laptop de 8 GB).
- **Hiperparámetros:** 3 épocas, lr 2e-4, 635 ejemplos (train + val), 240 pasos, 4 635 s, pérdida final 0,003537, pérdida solo sobre la respuesta del asistente, `enable_thinking=false`.
- **Dataset de órdenes.** `train.jsonl` 580 líneas = 350 órdenes sintéticas + 30 negativos sintéticos + 200 negativos de MASSIVE es-ES. `val.jsonl` 55 (50 + 5). `test.jsonl` 65 = 60 órdenes de **moldes no vistos** (20 asignar, 20 ausencia, 20 quitar) + 5 negativos. Los negativos enseñan a devolver `null` cuando el mensaje no es una orden. De MASSIVE (FitzGerald et al., 2022) se excluyeron los dominios calendar y alarm porque se parecen a una orden, y quedaron 9 122 enunciados, de los que se tomaron 200 con semilla 42.
- **Sin fuga de plantilla (template leakage).** Si el test compartiera plantillas con el entrenamiento, el modelo podría memorizar la frase y la exactitud sería inflada. Por eso el test se generó con moldes que no están en el pool de entrenamiento. El corte train/val sí es por hash de la orden (`sha256 % 8`), por lo que val comparte moldes con train y no sirve para medir generalización; el test sí.

**La métrica.**

- **Exactitud total (exact match):** la predicción completa (empleado, turno, fechas, justificación, acción) debe coincidir. Por eso el base, que a veces acierta el nombre, queda en 3,08 %. Es una métrica dura.
- **Fechas (F1):** compara el conjunto de fechas predichas con el esperado (precisión y recall combinados); permite crédito parcial por fechas.
- **JSON válido:** base 90,77 %, afinados y Grok 100 %.
- **Bootstrap:** se remuestrean con reemplazo las 65 filas del test, 1 000 veces (semilla 42), se calcula la exactitud en cada remuestreo y se toman los percentiles 2,5 y 97,5. Da el intervalo de incertidumbre atribuible al tamaño del test. **IC que no se solapan** (v2 [73,85; 90,77] y Grok [95,38; 100]): es un criterio conservador; los IC que no se solapan implican una diferencia que difícilmente es ruido de muestreo. **IC que sí se solapan** (v1 [66,15; 87,69] frente a v2): no permiten concluir que no hay diferencia, solo que con n = 65 no se separa del ruido. La prueba más adecuada para comparar dos modelos en el mismo test es **pareada** (McNemar o bootstrap pareado); no la corrimos. **Por qué importa n = 65:** cada fila vale 1,54 puntos; v1 → v2 son 4 filas (50 → 54 de 65), y con ese tamaño el intervalo se extiende unos 9 a 11 puntos hacia cada lado.
- **Una sola corrida de Grok.** El intervalo de Grok mide la variación del test, no la del modelo entre repeticiones: se corrió una vez.

**Cifras que hay que saber de memoria (n = 65):** base 3,08 %; v1 76,92 % [66,15; 87,69]; v2 83,08 % [73,85; 90,77]; Grok 98,46 % [95,38; 100]. Aciertos exactos: v1 50, v2 54, Grok 64.

### Preguntas probables del jurado

1. **¿Por qué no usar solo Grok si gana?** Hoy, en exactitud, Grok es la mejor opción y la app lo usa si el extractor propio no está o falla. Las razones para investigar el modelo pequeño son tres: privacidad (la nómina no sale de la organización), costo marginal por orden y control. Del costo por orden **no tenemos medición**, así que no afirmamos ahorro; solo que es una hipótesis razonable. Además, la pregunta de investigación es justamente cuánto falta.
2. **¿Por qué un modelo de 0,8B?** Es el más pequeño de la familia y cabe con holgura en una GPU de 8 GB (pico de 2 871,62 MiB en el entrenamiento). Un modelo mayor probablemente rinda más; no lo probamos por el límite de hardware. La arquitectura original planteaba 4B.
3. **¿La exactitud de 76,92 % es sobre datos que el modelo ya vio?** No: el test usa moldes que no están en el entrenamiento. Sí es sintético, y los alias y las frases siguen nuestro generador.
4. **¿Por qué el base saca solo 3,08 %?** Porque la exactitud total exige todo el JSON correcto y el base falla en turno (36,92 %), acción (55,38 %) y sobre todo en fechas (F1 19,18 %).
5. **¿Qué errores comete v1?** El más claro: confundir «no le deje turno» (quitar) con una ausencia, y resolver mal fechas relativas como «el lunes».

### Si algo falla

Si no se puede ejecutar nada de esto en vivo, no hace falta: la lámina no depende de la red.

---

## Lámina 11 — Dónde actuó el DPO

**Tiempo:** 1 min. **Quién (sugerido):** David.

### Qué decir

«Lo interesante es dónde mejoró. Las correcciones simuladas señalaban sobre todo órdenes como “no le deje turno”, que el modelo confundía con ausencias. Con solo 29 pares, el DPO subió el acierto de esa acción de 50 a 90 %.

Lo que no movió fue el calendario: la F1 de fechas se quedó en 84,6 %, y ahí está casi toda la distancia con Grok, que llega a 98,5 %. El aprendizaje fue dirigido: corrigió lo que la señal pedía, nada más.»

### Teoría que hay que dominar

**DPO (Direct Preference Optimization; Rafailov et al., 2023).**

- **Punto de partida: RLHF.** El método clásico tiene tres etapas: (1) ajuste supervisado, (2) entrenar un **modelo de recompensa** con preferencias humanas, (3) optimizar la política con refuerzo (PPO) maximizando la recompensa con una penalización KL para no alejarse del modelo de referencia. Es costoso, inestable y exige muestrear del modelo durante el entrenamiento.
- **La idea de DPO.** La política óptima de ese problema con restricción KL tiene una forma cerrada, así que la recompensa se puede escribir con la propia política: `r(x, y) = β · log(πθ(y|x) / πref(y|x))`. Sustituyéndola en el modelo de preferencias de Bradley–Terry, el problema se reduce a una pérdida de clasificación binaria directa sobre los pares. **No hay modelo de recompensa ni PPO ni muestreo.**
- **La pérdida.** Para un par con respuesta elegida `y_w` y rechazada `y_l`:
  `L = −log σ( β · [ log(πθ(y_w|x)/πref(y_w|x)) − log(πθ(y_l|x)/πref(y_l|x)) ] )`.
  Intuición: sube la probabilidad relativa de la respuesta elegida y baja la de la rechazada, **medidas respecto a un modelo de referencia congelado**. Si la política es igual a la referencia, el término dentro de σ es 0 y la pérdida vale `−log(0,5) = ln 2 ≈ 0,6931`: es exactamente el valor del primer paso de nuestro entrenamiento (0,6931471824645996), un buen chequeo de cordura.
- **β (0,1 en nuestro caso)** controla cuánto puede alejarse la política de la referencia: valores altos la mantienen cerca; valores bajos permiten moverse más.
- **Referencia congelada.** Nuestro DPO parte del adaptador v1 (entrenable) y la referencia es una copia congelada de v1 que gestiona TRL con PEFT (`ref_model=None`). Así v2 se mide como un desplazamiento respecto de v1.
- **Datos y corrida de E2.** 29 pares (las correcciones; las 91 aprobaciones limpias no tienen `rechazada` y no entran), 1 época, lr 5e-6, β 0,1. La pérdida bajó de 0,6931 a 0,5862, `rewards/accuracies` 0,6875, 206 s de entrenamiento, pico de VRAM 8 428,99 MiB. Ojo: ese pico supera los 8 188 MiB físicos de la tarjeta; en Windows el driver de NVIDIA desborda a memoria compartida del sistema en vez de fallar por falta de memoria, a costa de velocidad. Si lo preguntan: el DPO carga política y referencia (vía el adaptador), por eso usa más memoria que el QLoRA (2 871,62 MiB).
- **Por qué DPO y no seguir con SFT.** SFT sobre la respuesta corregida enseña «esta es la buena» pero no empuja explícitamente hacia abajo el error concreto que el modelo cometió. El par `(chosen, rejected)` enseña el contraste: «no esto, sí aquello». Con datos escasos y errores sistemáticos (quitar frente a ausencia) esa señal es más eficiente en teoría. **Pero no corrimos un control SFT con las mismas 29 correcciones**, así que no podemos afirmar que DPO supere a SFT aquí; es una hipótesis razonable no probada.

**Lectura del resultado.**

- Total v1 → v2: 76,92 % → 83,08 % (+6,15 pp, 4 filas más: 50 → 54 de 65). Los IC se solapan.
- Subgrupo `quitar` (n = 20): acción 50 % → 90 %; exactitud total 50 % → 70 %. En el resto (n = 45) no se mueve (88,89 % → 88,89 %).
- Fechas (F1) en el total: 84,62 % → 84,62 %. Fechas absolutas (n = 5): exactitud total 0 % → 0 % (la acción sube a 80 %, pero la fecha sigue mal).
- Conclusión que se puede sostener: el DPO movió la acción donde estaba la señal; no tocó el calendario. Lo que no se puede sostener: que el efecto sea estadísticamente significativo ni que se generalice a personas reales.

**Por qué las fechas no se movieron (hipótesis, no probada).** Los 29 pares corregían sobre todo la acción, así que la señal no tenía información sobre fechas. Una mejora práctica sería resolver las fechas con un normalizador determinista (reglas) después del modelo en vez de pedirle al modelo que calcule el calendario. Es una propuesta, no algo implementado. Además hay una discrepancia abierta documentada: dos resolutores de «de hoy en ocho» (+7 días en el dataset y «hoy + 8» en el prompt de Grok).

### Preguntas probables del jurado

1. **¿Por qué DPO y no seguir con SFT?** Ver la teoría: contraste explícito entre lo que el modelo dijo y lo correcto, sin modelo de recompensa. Y se dice con honestidad que no hicimos el control SFT.
2. **29 pares, ¿no es demasiado poco?** Sí, es poco, y lo decimos. Sirve para mostrar el mecanismo y su dirección, no para estimar el efecto real. Por eso reportamos intervalos y no afirmamos significancia.
3. **¿Cómo sabe que mejoró «quitar» por el DPO y no por azar?** No lo sabemos con certeza estadística. Es un subgrupo de n = 20: pasó de 10 a 18 aciertos de acción. Es consistente con la señal (las correcciones eran sobre `quitar`), pero la prueba formal (pareada) falta.
4. **¿Por qué β = 0,1?** Es el valor por defecto habitual en la literatura y en TRL. No lo ajustamos.
5. **¿Y si el simulador y el test comparten sesgos?** Es un riesgo real: el simulador usa órdenes nuevas (120) distintas del test (65), con semilla 42; pero ambos vienen de nuestro generador. Cualquier regularidad del generador la podría aprender el modelo sin que sirva para lenguaje real.

### Si algo falla

Nada.

---

## Lámina 12 — La pregunta de investigación

**Tiempo:** 1 min. **Quién (sugerido):** David.

### Qué decir

«Nuestra pregunta era: ¿puede un modelo pequeño, afinado con las correcciones de sus propios usuarios, alcanzar al modelo de frontera? La respuesta honesta, con estos datos, es que hoy no: le faltan unos quince puntos, sobre todo en fechas.

Pero el experimento muestra el mecanismo funcionando: la señal humana movió exactamente lo que debía. Y como cada decisión de la tarjeta produce datos sin costo extra, acumular esa señal es parte natural del uso. Con suficientes correcciones reales, un modelo local, barato y que no saca los datos de la nómina de la empresa podría ser la opción correcta.»

### Teoría que hay que dominar

- **Componente prospectivo (1–5 años).** La rúbrica pide explorar tecnologías emergentes aunque hoy tengan limitaciones, y menciona el aprendizaje continuo/autónomo entre las líneas posibles. Nuestra línea: modelos pequeños que mejoran con la corrección de sus usuarios (small language models + preferencias humanas implícitas).
- **Respuesta con evidencia.** Hoy no alcanza: Grok 4.7 98,46 % [95,38; 100] frente a v2 83,08 % [73,85; 90,77]; diferencia de 15,38 pp con IC que no se solapan. La brecha restante se concentra en fechas (F1 84,62 % frente a 98,46 %); en acción son 3,08 pp (96,92 % frente a 100 %), en justificación 1,54 pp; empleado, turno y JSON válido ya coinciden.
- **Lo que no se midió y no se debe insinuar:** cuánto subiría con más pares, con pares de personas, o el costo por orden de cada opción. Lo que sí quedó: cabe en 8 GB y la nómina no salió de la máquina durante el entrenamiento.
- **Por qué el diseño favorece acumular señal.** La tarjeta ya existe para la gobernanza, así que cada decisión produce un par sin trabajo adicional de anotación: es la ventaja estructural del humano en el lazo.
- **Frase de seguridad:** «No afirmamos que el pequeño alcance a la frontera ni que no pueda; afirmamos que hoy no la alcanza en esta tarea y dónde está la distancia.»

### Preguntas probables del jurado

1. **Si la respuesta es «no», ¿qué aporta el trabajo?** Aporta el ciclo funcionando de punta a punta, la medición con intervalos y el diagnóstico de dónde está la brecha. Una respuesta negativa bien medida es un resultado: dice qué señal falta (fechas) y qué condiciones lo harían viable.
2. **¿Qué haría falta para cerrar la brecha de fechas?** Más pares con corrección de fechas, un normalizador determinista de fechas relativas, o un modelo base mayor. Son hipótesis; ninguna está probada.
3. **¿Cuántos datos reales necesitarían?** No lo sabemos; no medimos la curva de aprendizaje respecto del número de pares. Es trabajo futuro.
4. **¿Y si el modelo de frontera mejora aún más?** Probable. Por eso la ventaja del modelo local debe estar en privacidad y costo, no en vencer en exactitud.

### Si algo falla

Nada.

---

## Lámina 13 — Gobernanza

**Tiempo:** 1 min. **Quién (sugerido):** Isabel.

### Qué decir

«La seguridad no depende de que el modelo se porte bien. La herramienta de escritura simplemente no existe para él, y una prueba automática lo verifica. En la base de datos, los agentes usan un rol de solo lectura; la escritura ocurre únicamente dentro de la transacción que dispara una tarjeta aprobada, y esa transacción bloquea la propuesta para que no se pueda decidir dos veces.

Todo queda trazado en Phoenix: cada turno, cada herramienta y cada veredicto del auditor. Y los guardrails de citas, alcance por equipo y límite de uso tienen cada uno su prueba.»

### Teoría que hay que dominar

- **Humano en el lazo y mínimo privilegio.** El permiso de escritura es la decisión de una persona; el sistema tiene el mínimo de privilegios necesarios. Cuatro capas independientes: (1) la herramienta `ejecutar_propuesta` no está en la lista del modelo, y al arrancar `afirmarSinEscrituraDirecta` lanza error si aparece; (2) roles de base de datos `relevo_lector` y `relevo_escritor`, ambos `NOLOGIN`, sin contraseñas en el SQL; (3) `SET LOCAL ROLE relevo_escritor` solo dentro de la transacción de ejecución: el cambio de rol se deshace al terminar la transacción; (4) la tarjeta congela las `acciones` y la ejecución no reinterpreta la orden.
- **`SELECT … FOR UPDATE`.** Bloquea la fila de la propuesta dentro de la transacción: si dos aprobaciones llegan a la vez, la segunda espera, ve que ya no está `pendiente` y responde 409 («La propuesta ya fue decidida»). Evita doble escritura (condición de carrera).
- **Atomicidad.** Escritura de nómina, aprobación, par de preferencia y cambio de estado en una sola transacción.
- **Guardrails de ejecución (backend, no prompt).** Mensaje vacío o de más de 2 000 caracteres → 400; más de 30 peticiones por minuto por usuario → 429; respuesta normativa sin cita ni llamada a `buscar_norma` → se anexa advertencia y el span marca `guardrail.citas=false`; recorte de alcance por equipo.
- **Observabilidad con OpenTelemetry.** OpenTelemetry es el estándar neutral para trazas: un **trace** es una operación completa (un turno); un **span** es una unidad de trabajo dentro de ella, con atributos. Se exporta por OTLP (protobuf; la imagen de Phoenix devolvió 415 con JSON) al puerto 6006. **OpenInference** es el conjunto de convenciones semánticas para trazas de LLM (tipos de span `AGENT`, `LLM`, `TOOL`, `RETRIEVER`, entre otros) que Phoenix sabe interpretar. Spans propios: `relevo.turno` (AGENT), `relevo.router`, `relevo.extraccion`. `streamText` lleva `experimental_telemetry`. **Arize Phoenix** es la interfaz para abrir una conversación después y ver cada herramienta. Matiz: la comparación base → v1 → v2 está en `ml/runs/comparacion.md`, no en Phoenix.
- **Seguridad de datos.** Secretos solo en `.env`; el DSN no se imprime completo; sin clave el chat no llama a xAI y lo dice.

### Preguntas probables del jurado

1. **¿Y la inyección de instrucciones (prompt injection)?** El peor caso es que un texto malicioso lleve al modelo a proponer una tarjeta indebida: no puede escribir, porque no tiene la herramienta, y la persona ve la tarjeta. El corpus es texto legal público. No hicimos un ejercicio de red-team formal, y lo decimos.
2. **¿Y si alguien se salta el chat y llama la API directamente?** La ejecución exige una propuesta existente en estado pendiente y valida de nuevo antes de escribir. La API no tiene login: la decisión viaja con un usuario constante (`coordinador`). Es una limitación de prototipo: no hay autenticación real.
3. **¿Quién audita al auditor?** Sus reglas son código con pruebas (20 escenarios) y su veredicto es reproducible. No hay un segundo auditor.
4. **¿La traza expone datos personales?** Los datos son sintéticos. En producción habría que decidir qué atributos se exportan a Phoenix.

### Si algo falla

Si Phoenix no está encendido, se muestra la captura del informe (sección 5.6) y se explica el span `relevo.turno`; el chat no depende de Phoenix.

---

## Lámina 14 — Arquitectura de despliegue

**Tiempo:** 1 min. **Quién (sugerido):** David.

### Qué decir

«Una pregunta natural es dónde corre todo esto. La demo de hoy corre en la nube, en tres proveedores con planes gratuitos y con la misma arquitectura que en local.

El navegador entra por una URL pública protegida con un código de acceso, para que nadie pueda gastar nuestra clave de xAI. En Vercel vive la aplicación: el chat, el servidor MCP y el auditor A2A, que son rutas de la misma app; el asistente sigue llamando al auditor por HTTPS, así que el protocolo viaja de verdad por internet. La base está en Neon: PostgreSQL con pgvector y los 589 fragmentos con sus vectores ya calculados.

Los modelos viven aparte, en Modal: los embeddings, siempre tibios en CPU, y nuestro extractor en una GPU que escala a cero; si está frío, el sistema cae a Grok. Phoenix queda en local: en la nube no exportamos trazas. Y si algo falla hoy, tenemos el mismo sistema corriendo en local como plan B.»

### Teoría que hay que dominar

Los límites y precios de cada plan cambian; las cifras de abajo son las que se configuraron el 12 de octubre de 2026. Antes de ensayar, confirmen cada una en el panel del proveedor y no digan una cifra que no hayan visto allí.

- **Funciones serverless.** Cada petición se atiende en un contenedor efímero y sin estado que el proveedor crea y destruye a su ritmo; no pagamos ni administramos un servidor encendido. Límites que hay que conocer: (1) **duración máxima** por invocación (en Vercel Hobby, hasta 300 s con nuestra configuración; un turno de RAG agéntico tarda unos 25 s, así que cabe con holgura); (2) **memoria** acotada (2 GB en Hobby) y tamaño máximo del paquete (cientos de MB), lo que descarta cargar un modelo de embeddings de más de 2 GB; (3) **sin disco persistente ni procesos en segundo plano**: lo que importa se guarda en la base; (4) **arranque en frío**: la primera petición tras un rato inactivo debe cargar el código y puede tardar algo más. Por eso el estado vive en Neon y no en la memoria de la función, y la respuesta del chat va en *streaming*.
- **Escala a cero y arranques en frío (Neon y Modal).** «Escala a cero» significa que, sin tráfico, el proveedor apaga el recurso y deja de cobrar (o de gastar créditos); a cambio, la primera petición paga el arranque. **Neon** suspende el cómputo tras 5 minutos sin uso y la primera consulta tarda unos segundos; mitigación: una consulta de calentamiento (`SELECT 1`) justo antes de empezar y no dejar pasar 5 minutos sin actividad durante la presentación. **Modal** tiene dos políticas: los embeddings (bge-m3 en CPU) se mantienen con un contenedor mínimo encendido (`min_containers`; en versiones anteriores `keep_warm`), porque la web solo espera 3 s antes de caer a búsqueda léxica; el extractor corre en GPU y escala a cero, porque mantener una GPU encendida gasta los créditos muy rápido. Si está frío, la web usa Grok como extractor (el mismo respaldo que ya existía). Dos respaldos distintos, uno por servicio: **léxico** si los embeddings no responden a tiempo, **Grok** si el extractor está frío.
- **Pool de conexiones y por qué el modo transacción prohíbe lo que prohíbe.** Las funciones serverless abren muchas conexiones cortas y PostgreSQL tiene pocas conexiones simultáneas (cada una es un proceso), así que Neon ofrece un **pooler** (PgBouncer) delante. En modo transacción, una conexión real del servidor se presta al cliente **solo mientras dura una transacción**, y la siguiente transacción del mismo cliente puede caer en otra conexión. Consecuencias: (1) las **sentencias preparadas con nombre** viven en una conexión concreta; si la siguiente transacción cae en otra, falla con «prepared statement does not exist». Por eso el cliente `postgres-js` lleva `prepare: false` (algunas versiones recientes del pooler admiten sentencias preparadas de protocolo, pero no dependemos de ello). (2) Un **`SET ROLE` de sesión** quedaría pegado a la conexión del servidor y la heredaría otro cliente: sería una fuga de privilegios (alguien con el rol de escritura sin merecerlo) o se perdería, según la suerte. Por eso la escritura usa `SET LOCAL ROLE relevo_escritor` **dentro de la transacción de ejecución**: `SET LOCAL` dura solo hasta el `COMMIT`/`ROLLBACK` y no se filtra. Es el mismo diseño de la lámina 13, y ahora además es seguro frente al pooler. Otras cosas de sesión que no se pueden usar con pooler transaccional: `LISTEN/NOTIFY`, bloqueos asesores de sesión y tablas temporales.
- **Por qué los modelos viven aparte de la web.** Una función serverless tiene memoria y paquete acotados, no tiene GPU y se apaga sola; un modelo necesita cargar sus pesos (bge-m3 pesa del orden de 2 GB; Qwen3.5-0.8B con su adaptador necesita GPU para responder en tiempos razonables) y se amortiza si se queda cargado. Modal da exactamente eso: contenedores con GPU o CPU, facturación **por segundo** y un Volume donde viven los pesos y el adaptador LoRA/DPO v2. La separación también es un buen diseño: se escala y se cobra cada parte por separado, y la web puede degradarse con gracia (léxico, Grok) si el servicio de modelos falla.
- **Gestión de secretos.** Cada plataforma guarda sus variables de entorno cifradas y fuera del repositorio: Vercel (`XAI_API_KEY`, la URL de Neon, `ACCESS_CODE`, los tokens), Modal (sus *Secrets*), y en local `.env`, que está ignorado por git (`.env.example` solo documenta los nombres). Nunca van en el código, en los logs, en las diapositivas ni en el chat. Después de la presentación se **rotan** las claves y el código de acceso, porque se usaron en una sesión pública.
- **Código de acceso y tokens entre servicios.** Son dos capas distintas. El **código de acceso** (`ACCESS_CODE`) protege la interfaz: sin él, una URL pública permitiría a cualquiera consumir el saldo de xAI. Los **tokens de servicio** (portador o *bearer*) protegen las llamadas máquina a máquina: Vercel → Modal, y asistente → auditor. Un token compartido es suficiente para un prototipo; no sustituye a una autenticación de usuarios real (la API sigue sin login, como se dijo en la lámina 13).
- **A2A sobre internet pública.** El protocolo no cambia por salir de localhost: el auditor publica su **Agent Card** en `/.well-known/agent.json` (nombre, descripción, URL y capacidades: es cómo otro agente lo descubre) y recibe `message/send` por JSON-RPC sobre HTTPS en `/a2a`. Lo que sí cambia es la exposición: hay que cifrar (HTTPS, lo da Vercel), autenticar la llamada (token compartido) y asumir que la tarjeta es metadato descubrible. Confirmen con el equipo cómo quedó configurada la protección del Agent Card y del endpoint antes del ensayo.
- **Modelo de costo.** Hoy el costo directo es casi nulo: Vercel Hobby y Neon Free son gratuitos; Modal Starter trae unos US$30 mensuales de créditos y cobra por segundo de cómputo usado; xAI cobra por token y es el único gasto que depende del uso (el código de acceso lo protege). Lo que más gasta de Modal es **mantener algo encendido**: un contenedor tibio consume créditos 24 horas al día, así que se enciende para la presentación y se baja después. No medimos el costo por orden (está en «lo que no se hizo» de la lámina 15).
- **Qué cambiaría en producción.** Planes de pago (Vercel Pro para más duración y equipo; Neon con cómputo que no se suspende o con suspensión controlada; Modal con GPU reservada si hay tráfico constante); **Phoenix gestionado** (o un colector OTel) para tener las trazas también en la nube; **autenticación real** con usuarios y roles en lugar del código compartido; **región** elegida por latencia (para Colombia, São Paulo si el plan la ofrece, frente a Washington D.C. por defecto); copias de seguridad y monitoreo de la base; y una revisión de protección de datos personales (Ley 1581 de 2012, incluida la transferencia internacional) antes de cargar nómina real.

### Preguntas probables del jurado

1. **¿Cuánto cuesta?** Hoy, nada de bolsillo: todo corre en planes gratuitos. Modal gasta créditos mensuales (unos US$30) y xAI cobra por token, que es el único gasto real y está protegido por el código de acceso. En producción el costo vendría sobre todo de la GPU y de la base sin suspensión; no tenemos una medición de costo por orden y no la inventamos.
2. **¿Qué pasa si Modal está frío?** Depende del servicio. Los embeddings se mantienen tibios; si aun así tardan más de 3 s, la búsqueda cae a léxico y responde, con la calidad medida del modo léxico (recall@5 12,5 %, fidelidad 0,188 frente a 100 % y 0,926 del híbrido, según `evaluacion/citas_lexica.md`). El extractor escala a cero: si está frío, la web usa Grok. En ambos casos el usuario recibe respuesta; lo que cambia es la calidad o la latencia, y se dice de frente.
3. **¿Es seguro tener la URL pública?** Es razonable para una demostración, no para producción. Hay un código de acceso delante de toda la app, HTTPS, tokens entre servicios, secretos fuera del repositorio y un modelo que no puede escribir (lámina 13). Faltan autenticación por usuario, límites de uso por cliente más finos y un red-team formal. Los datos son sintéticos, así que la exposición de datos personales es nula.
4. **¿Por qué tres proveedores y no uno?** Porque cada pieza tiene un requisito distinto: Vercel es lo más natural para Next.js y sus funciones; Neon da PostgreSQL con pgvector gestionado, algo que una función serverless no puede ser; Modal da GPU y memoria por segundo, que Vercel no ofrece. Con uno solo habría que renunciar a algo: una VM única sería más simple pero sin escala a cero y con costo fijo. A cambio, hay más secretos y más puntos de falla, y por eso cada uno tiene un respaldo. Y gracias a que cada servicio se conecta por variables de entorno (`DATABASE_URL`, `EMBED_SERVICE_URL`, `AUDITOR_URL`, `EXTRACTOR_URL`), moverlo es configuración, no reescritura.
5. **¿Por qué no Hugging Face Spaces?** Era el plan para los modelos, pero en 2026 las condiciones de la CPU gratuita se restringieron para cuentas nuevas (lo reportan usuarios en los foros; no hay anuncio oficial), y ZeroGPU exige Gradio y cuentas antiguas. Modal da GPU por segundo con créditos mensuales y permite servir nuestros dos modelos con los mismos contratos HTTP. No digan que lo intentaron en Spaces: no se intentó.
6. **¿Por qué desplegar los modelos y no solo la web?** Porque sin ellos la recuperación sería solo léxica: recall@5 12,5 % y fidelidad 0,188 frente a 100 % y 0,926 del híbrido (control medido en `evaluacion/citas_lexica.md`). Una web sola mostraría una versión recortada del sistema.
7. **¿Los datos salen de Colombia?** Sí, y hay que decirlo sin rodeos: las regiones por defecto de Vercel, Neon y Modal están en Estados Unidos, y las preguntas viajan también a la API de xAI. Es aceptable aquí porque **todos los datos son sintéticos**. Con nómina real habría que elegir región (São Paulo es la más cercana), revisar la Ley 1581 de 2012 sobre transferencia internacional de datos personales y, probablemente, no enviar datos personales al proveedor del modelo. No evaluamos ese cumplimiento.
8. **¿Y Phoenix, por qué no está en la nube?** No lo desplegamos: es un servicio con almacenamiento propio que no entra en estos tres planes y no era prioritario para la demo; en la nube la exportación OTel está apagada. Las trazas siguen disponibles en local. En producción usaríamos Phoenix gestionado o un colector.

### Si algo falla

No se improvisa: se pasa al sistema local, que es la misma aplicación. Con calma y sin disculparse: «La nube no respondió en este momento; es el mismo sistema, lo corro en mi máquina». El procedimiento paso a paso (base con `docker compose up -d db`, servicios de modelos, aplicación) está en `informe/GUION_DEMO.md`; ensáyenlo antes de entrar. Si solo falla un servicio de modelos, no hay que cambiar nada: el sistema cae solo a léxico o a Grok, y se dice qué pasó. Si Neon tarda en la primera consulta, es el arranque en frío: se espera unos segundos y se explica. Si la nube no llegó a pasar las cuatro interacciones antes de la presentación, la lámina se ajusta a lo que sí quedó desplegado y la demo se hace en local.

---

## Lámina 15 — Limitaciones y próximos pasos

**Tiempo:** 0,75 min. **Quién (sugerido):** Isabel.

### Qué decir

«Somos transparentes con lo que falta. Primero, usuarios reales: las 120 decisiones de entrenamiento son simuladas. El protocolo de sesiones de quince minutos ya está listo; faltan las sesiones, y esas decisiones serán pares humanos reales.

Segundo, las fechas absolutas: “el 12 de octubre” sigue fallando en el extractor propio y es la brecha principal con el modelo de frontera.

Tercero, la latencia local: unos 11 segundos por extracción en Windows sin kernels optimizados. Y cuarto, la observabilidad en la nube: Phoenix sigue en local y en la nube las trazas no se exportan.»

### Teoría que hay que dominar

- **Sesgos de la evaluación.** Simulador y test salen del mismo generador; el juez de citas es de la misma familia que el asistente; Grok se corrió una vez; n pequeños (65 y 20); el auditor se evaluó con casos que diseñamos nosotros.
- **Lo que no se hizo:** pruebas con usuarios (0 sesiones), autenticación real y Phoenix en la nube (el despliegue es de demostración), voz, cartillas del Ministerio, prueba pareada entre versiones, control SFT, curva de aprendizaje frente al número de pares, medición de costo por orden, red-team.
- **Latencia.** 69,087 s en frío y 11,098 s en caliente para una extracción del modelo local (reporte E2); en la demo, la extracción la hace Grok. El kernel faltante en Windows (Gated DeltaNet sin `causal_conv1d` ni `flash-linear-attention`) explica parte; no está medido cuánto bajaría en Linux con GPU.
- **Hallazgo de ingeniería a mencionar si preguntan por errores:** el reindexado del 21 de septiembre (commit `a21a6d6`): las leyes de Función Pública vienen en UTF-8 con BOM y BeautifulSoup las leía como cp1252, dejando 0 artículos; corregido, el corpus pasó de 497 chunks / 18 documentos (B2) a 589 / 20 (vigente).

### Preguntas probables del jurado

1. **¿Por qué no hicieron las pruebas con usuarios?** El tiempo de entrega; el protocolo (guion de 15 minutos, cuestionario Likert, plantilla CSV) está en `evaluacion/PROTOCOLO_USUARIOS.md`. Es el primer paso pendiente.
2. **¿Cuál sería su prioridad si tuvieran dos semanas?** Sesiones con 5–10 coordinadores reales para obtener pares humanos, un normalizador determinista de fechas, y una prueba pareada para v1 frente a v2.
3. **¿Está desplegada?** Sí, como demostración: Vercel, Neon y Modal en planes gratuitos, con datos sintéticos (lámina 14). Lo que no: autenticación real, Phoenix en la nube y una medición de costo por orden. No es un despliegue de producción y no lo presentamos como tal.

### Si algo falla

Nada.

---

## Lámina 16 — Cierre

**Tiempo:** 0,5 min. **Quién (sugerido):** Isabel.

### Qué decir

«Cerramos con el principio que guió todo el proyecto: el agente consulta con autonomía, pero nunca escribe sin la aprobación de una persona. Y cada una de esas aprobaciones se convierte en un dato que mejora el modelo propio.

El código, el informe y las evaluaciones están en el repositorio. Gracias; quedamos atentos a sus preguntas.»

### Teoría que hay que dominar

- **Las tres ideas que el jurado debe llevarse:** (1) separación consulta/escritura con la tarjeta como permiso, (2) RAG híbrido agéntico con citas medido, (3) ciclo de aprobación → DPO medido con honestidad.
- **Frase corta de respuesta a «¿qué aprendieron?»:** que en un agente con acciones, el diseño de los permisos importa tanto como el modelo; y que una evaluación honesta (con intervalos, con un rival fuerte y con las limitaciones dichas) vale más que una cifra alta.

### Preguntas probables del jurado

1. **¿Qué cambiarían de la arquitectura?** Mover el router a un clasificador afinado, normalizar fechas con reglas, y añadir autenticación real.
2. **¿Cómo se repartieron el trabajo?** Cada uno debe poder responder esto con sus propias partes; acordarlo antes del ensayo.

### Si algo falla

Nada.

---

## Mapa de la rúbrica

| Criterio (peso) | Láminas | Momentos de la demo | Evidencia en el repositorio |
|---|---|---|---|
| Originalidad e innovación (15 %) | 9, 10, 11, 12 | Interacción 4: la aprobación produce el par | `informe/INFORME_FINAL.md` §7, `ml/dpo/` |
| Calidad técnica: NLP, LLMs, RAG, embeddings (25 %) | 4, 5, 6, 7, 10, 11 | Interacción 1 (RAG agéntico con 4 búsquedas); interacción 3 (extracción de «próximo domingo») | `mcp/consultas.ts`, `lib/agente/`, `ml/extractor/`, `ml/dpo/` |
| Uso adecuado de tecnologías (15 %) | 6, 13, 14 | Interacción 2 (herramientas MCP); interacción 3 (auditor A2A); Phoenix si hay RAM | MCP, A2A (`auditor/`), pgvector, bge-m3, Hugging Face (peft, trl), Phoenix, Vercel, Neon, Modal |
| Funcionalidad de la aplicación (20 %) | 3, 4, 5, 13 | Las cuatro interacciones; el chip de intención, el panel Fuentes, la tarjeta, el veredicto | `app/`, `components/`, `lib/agente/flujo-escritura.ts` |
| Evaluación y validación (10 %) | 7, 8, 10, 11, 15 | Menciones de IC y de n en la charla | `evaluacion/`, `informe/INFORME_FINAL.md` §8 |
| Presentación final (10 %) | todas | Demo guiada, plan B ensayado | Este guion y `informe/GUION_DEMO.md` |
| Informe escrito (5 %) | 16 | Remitir al repositorio | `informe/INFORME_FINAL.md` |

Objetivos de la guía que se evidencian además: tool use autónomo y memoria (lámina 4, interacciones 1–2 y cambio de perfil), datos estructurados y no estructurados (interacciones 1 y 2), aprendizaje continuo (láminas 9 a 11), comunicación entre agentes MCP/A2A (lámina 6), componente prospectivo (lámina 12).

## Glosario

- **Agente:** LLM que decide llamar herramientas en un ciclo hasta responder o llegar a una condición de parada.
- **Tool calling:** el modelo devuelve el nombre de una herramienta y sus argumentos; el código la ejecuta.
- **`stopWhen`:** condición de parada del ciclo del agente; aquí `stepCountIs(6)`.
- **Salida estructurada:** JSON que cumple un esquema (Zod) validado por el SDK.
- **Router de intención:** clasificador de la intención del mensaje (charla, datos, norma, orden).
- **RAG:** respuesta generada a partir de texto recuperado de una base de conocimiento.
- **RAG agéntico:** el modelo decide si, cuándo y qué recuperar.
- **Embedding:** vector que representa el significado de un texto.
- **bge-m3:** modelo de embeddings multilingüe de BAAI; aquí, 1 024 dimensiones.
- **Similitud coseno:** coseno del ángulo entre dos vectores; con vectores normalizados es el producto punto.
- **HNSW:** índice aproximado de vecinos más cercanos basado en un grafo en capas.
- **`tsvector`:** representación de texto con lexemas para búsqueda léxica en PostgreSQL.
- **Stemming:** reducir una palabra a su raíz.
- **RRF:** fusión de listas por rango, `Σ 1/(k + rango)`, con k = 60.
- **Cross-encoder:** modelo que puntúa el par consulta–documento con atención conjunta.
- **Chunk:** fragmento del corpus; aquí, un artículo de ley.
- **recall@k:** fracción de los artículos esperados que aparece en los k primeros resultados.
- **MRR:** media del inverso del rango del primer acierto.
- **LLM-as-judge:** un modelo evalúa la salida de otro; tiene sesgos, como la autopreferencia.
- **LoRA:** ajuste con matrices de bajo rango, `W' = W + (α/r)BA`.
- **QLoRA:** LoRA sobre un base cuantizado a 4 bits (NF4, doble cuantización).
- **DPO:** optimización directa con pares preferido/rechazado y un modelo de referencia, sin modelo de recompensa.
- **MCP:** protocolo abierto entre un cliente de modelo y servidores de herramientas.
- **A2A:** protocolo abierto entre agentes: Agent Card, `message/send`, tareas y artefactos.
- **Serverless:** funciones que el proveedor crea y destruye por petición, sin servidor administrado y con límites de duración y memoria.
- **Arranque en frío:** retraso de la primera petición cuando el recurso estaba apagado o inactivo.
- **Escala a cero:** apagar el recurso sin tráfico para no pagar; la primera petición paga el arranque.
- **Pooler de conexiones:** intermediario (PgBouncer) que reparte pocas conexiones reales entre muchos clientes; en modo transacción presta la conexión solo durante una transacción.
- **Bootstrap (IC 95 %):** remuestreo con reemplazo para estimar la incertidumbre de una métrica.

## Checklist del ensayo

Cada integrante debe poder explicar **sin notas**, con un ejemplo de Relevo y sin leer la lámina:

**Todos**

- El principio de diseño y por qué el modelo no tiene la herramienta de escritura.
- El recorrido de una orden de escritura, de la frase a la fila `origen = 'tarjeta'`.
- Las cifras centrales: 3,08 → 76,92 → 83,08 → 98,46; quitar 50 → 90; recall@5 100 %, MRR 0,933, fidelidad 0,926; auditor 20/20; 589 chunks; 156 pruebas; 75,83 % simulado.
- Qué es simulado, qué no se midió y qué no se puede afirmar.

**Isabel (problema, gobernanza y limitaciones)**

- Humano en el lazo, mínimo privilegio, `SET LOCAL ROLE`, `FOR UPDATE`, atomicidad.
- Guardrails y observabilidad: OpenTelemetry, span, OpenInference, Phoenix.
- Ética de datos sintéticos y lo que la evaluación no cubre.
- Protocolo de usuarios y próximos pasos.

**Alejandro (arquitectura, recuperación y cifras)**

- MCP y A2A: qué es cada uno, qué subconjunto implementamos y por qué dos protocolos.
- Embeddings, coseno, HNSW, `tsvector`, RRF con la fórmula y un ejemplo numérico, re-ranking, chunking por artículo.
- recall@k y MRR con la fórmula; sesgo del juez; el 12,5 % léxico y por qué no está versionado.
- El auditor: reglas, veredictos, 20/20 y su límite.

**David (demo, despliegue, extractor, DPO, pregunta)**

- La demo completa, con los tiempos y el plan B.
- El despliegue: funciones serverless y sus límites, escala a cero y arranques en frío con sus mitigaciones, pooler en modo transacción (sin sentencias preparadas ni `SET ROLE` de sesión), por qué los modelos van aparte, secretos, código de acceso y tokens, A2A por internet, costo y qué cambiaría en producción.
- LoRA con la fórmula y `r`, `α`; QLoRA (NF4, doble cuantización, AdamW 8 bits); dataset y ausencia de fuga de plantilla.
- Exactitud total, F1 de fechas, bootstrap, IC que se solapan frente a los que no, por qué importa n = 65.
- DPO con la pérdida, β, referencia congelada, contraste con RLHF/PPO; por qué los 29 pares y por qué falta el control SFT.
- La respuesta a «¿es real el aprendizaje continuo si es simulado?».

**Antes del ensayo (tareas)**

- Abrir `evaluacion/resultados/citas.json` y leer la respuesta de c02 (fidelidad 0,500) para poder explicarla.
- Decidir si se corre `npm run eval:citas` sin el servicio de embeddings para versionar la columna léxica del 12,5 %.
- Grabar el video de la demo completa y guardarlo en `docs/entrega/`.
- Un ensayo cronometrado completo y otro con la variante de 12 minutos.
