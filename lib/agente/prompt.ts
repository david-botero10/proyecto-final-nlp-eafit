import type { Perfil } from "@/lib/memoria/tipos";
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

function bloquePerfil(perfil: Perfil): string {
  const alcance =
    perfil.rol === "gerente" || perfil.equipo === "todos"
      ? "Puedes consultar y proponer sobre todos los equipos."
      : `Solo puedes consultar y proponer sobre el equipo ${perfil.equipo ?? "sin equipo"}.`;
  return [
    "",
    "Usuario actual:",
    `usuario ${perfil.usuario}, rol ${perfil.rol}, equipo ${perfil.equipo ?? "sin equipo"}.`,
    alcance,
  ].join("\n");
}

/** System prompt del asistente. La clasificación orienta y no bloquea tools. */
export function systemRelevo(
  fecha: string,
  clasificacion: Clasificacion,
  perfil?: Perfil | null,
): string {
  const base = [
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
    "- Si la intención es orden_escritura, no afirmes que el cambio ya quedó hecho. Di «te propongo» el cambio y «revisa la tarjeta».",
    "- crear_propuesta solo deja una propuesta pendiente. La nómina no cambia hasta la aprobación humana.",
  ].join("\n");
  if (!perfil) {
    return base;
  }
  return `${base}\n${bloquePerfil(perfil)}`;
}
