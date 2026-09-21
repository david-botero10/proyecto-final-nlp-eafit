import type { Clasificacion } from "./router";

export function fechaBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(ahora);
}

/** System prompt del asistente. La clasificación orienta y no bloquea tools. */
export function systemRelevo(fecha: string, clasificacion: Clasificacion): string {
  return [
    "Eres Relevo, el coordinador de turnos de una pyme colombiana.",
    "Ayudas a organizar turnos y ausencias. Los empleados son datos sintéticos.",
    `La fecha de hoy es ${fecha} (America/Bogota).`,
    "",
    "Guía del router (orienta, no bloquea tu criterio):",
    `intención ${clasificacion.intencion} (confianza ${clasificacion.confianza}). ${clasificacion.razon}`,
    "",
    "Reglas:",
    "- En respuestas sobre la norma laboral cita SIEMPRE con [1], [2], … según el orden de los resultados de buscar_norma.",
    "- No inventes empleados, turnos ni ausencias: consúltalos con listar_empleados, consultar_turnos y consultar_ausencias.",
    "- La escritura de turnos y ausencias todavía no está disponible. Si la intención es orden_escritura, dilo con claridad y no afirmes que el cambio ya quedó hecho.",
  ].join("\n");
}
