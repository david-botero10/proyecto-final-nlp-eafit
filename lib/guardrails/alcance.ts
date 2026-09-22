export type PerfilAlcance = {
  usuario: string;
  rol: string;
  equipo: string | null;
};

export type Roster = {
  ids: Set<number>;
  nombres: Set<string>;
};

export type AlcanceListo = {
  args: Record<string, unknown>;
  roster: Roster | null;
};

export type AlcanceResultado = AlcanceListo | { error: string };

/** Sin perfil, o gerencia, no hay recorte. Un coordinador con equipo sí. */
export function equipoAcotado(
  perfil: PerfilAlcance | null | undefined,
): string | null {
  if (!perfil) {
    return null;
  }
  if (perfil.rol === "gerente" || perfil.equipo === "todos" || !perfil.equipo) {
    return null;
  }
  return perfil.equipo;
}

export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function mensajePropuestaFuera(
  equipo: string,
  nombre: string,
  equipoAjeno?: string,
): string {
  if (equipoAjeno) {
    return `No puedes proponer cambios para ${nombre}: está en ${equipoAjeno} y tu alcance es ${equipo}.`;
  }
  return `No puedes proponer cambios para ${nombre}: no pertenece a tu equipo (${equipo}).`;
}

export function mensajeConsultaFuera(equipo: string): string {
  return `Esa consulta está fuera de tu equipo (${equipo}). Solo puedes ver datos de ese equipo.`;
}

function rosterDesde(resultado: unknown): Roster | { error: string } {
  if (!resultado || typeof resultado !== "object") {
    return { error: "No pude verificar el alcance de tu equipo." };
  }
  if ("error" in resultado && typeof resultado.error === "string") {
    return { error: "No pude verificar el alcance de tu equipo." };
  }
  const empleados = (resultado as { empleados?: unknown }).empleados;
  const ids = new Set<number>();
  const nombres = new Set<string>();
  if (!Array.isArray(empleados)) {
    return { error: "No pude verificar el alcance de tu equipo." };
  }
  for (const fila of empleados) {
    if (!fila || typeof fila !== "object") {
      continue;
    }
    const empleado = fila as { id?: unknown; nombre?: unknown };
    if (typeof empleado.id === "number") {
      ids.add(empleado.id);
    }
    if (typeof empleado.nombre === "string") {
      nombres.add(normalizarNombre(empleado.nombre));
    }
  }
  return { ids, nombres };
}

function coincideNombre(consulta: string, nombre: string): boolean {
  const pedidos = normalizarNombre(consulta).split(" ").filter(Boolean);
  const suyos = nombre.split(" ");
  return pedidos.length > 0 && pedidos.every((token) => suyos.includes(token));
}

export function empleadoEnRoster(argumento: unknown, roster: Roster): boolean {
  if (typeof argumento === "number") {
    return roster.ids.has(argumento);
  }
  if (typeof argumento !== "string") {
    return false;
  }
  const recorte = argumento.trim();
  if (/^[0-9]+$/.test(recorte)) {
    return roster.ids.has(Number(recorte));
  }
  for (const nombre of roster.nombres) {
    if (coincideNombre(recorte, nombre)) {
      return true;
    }
  }
  return false;
}

function accionesFueraDeRoster(
  argumentos: Record<string, unknown>,
  roster: Roster,
): boolean {
  const acciones = argumentos.acciones;
  if (!Array.isArray(acciones)) {
    return false;
  }
  return acciones.some((accion) => {
    if (!accion || typeof accion !== "object" || !("empleado_id" in accion)) {
      return false;
    }
    const id = (accion as { empleado_id?: unknown }).empleado_id;
    return typeof id === "number" && !roster.ids.has(id);
  });
}

/**
 * Ajusta la llamada de una tool al equipo del perfil.
 * `llamar` es el MCP crudo: solo se usa para armar el roster, sin otro span.
 */
export async function aplicarAlcance(
  nombre: string,
  argumentos: Record<string, unknown>,
  perfil: PerfilAlcance | null | undefined,
  llamar: (nombre: string, args: Record<string, unknown>) => Promise<unknown>,
): Promise<AlcanceResultado> {
  const equipo = equipoAcotado(perfil);
  if (!equipo) {
    return { args: argumentos, roster: null };
  }
  if (nombre === "listar_empleados") {
    return { args: { ...argumentos, equipo }, roster: null };
  }
  const necesitaRoster =
    nombre === "consultar_turnos" ||
    nombre === "consultar_ausencias" ||
    nombre === "crear_propuesta";
  if (!necesitaRoster) {
    return { args: argumentos, roster: null };
  }
  const crudo = await llamar("listar_empleados", { equipo, activo: true });
  const roster = rosterDesde(crudo);
  if ("error" in roster) {
    return roster;
  }
  if (nombre === "crear_propuesta" && accionesFueraDeRoster(argumentos, roster)) {
    return { error: mensajePropuestaFuera(equipo, "esa persona") };
  }
  if (nombre === "consultar_turnos" || nombre === "consultar_ausencias") {
    if (
      argumentos.empleado !== undefined &&
      !empleadoEnRoster(argumentos.empleado, roster)
    ) {
      return { error: mensajeConsultaFuera(equipo) };
    }
    return { args: argumentos, roster };
  }
  return { args: argumentos, roster: null };
}

function esDeRoster(item: unknown, roster: Roster): boolean {
  if (!item || typeof item !== "object" || !("empleado" in item)) {
    return false;
  }
  const nombre = (item as { empleado: unknown }).empleado;
  return typeof nombre === "string" && roster.nombres.has(normalizarNombre(nombre));
}

export function filtrarResultado(
  nombre: string,
  resultado: unknown,
  roster: Roster | null,
): unknown {
  if (!roster || !resultado || typeof resultado !== "object") {
    return resultado;
  }
  if ("error" in resultado) {
    return resultado;
  }
  const fila = resultado as Record<string, unknown>;
  if (nombre === "consultar_turnos" && Array.isArray(fila.asignaciones)) {
    return {
      ...fila,
      asignaciones: fila.asignaciones.filter((item) => esDeRoster(item, roster)),
    };
  }
  if (nombre === "consultar_ausencias" && Array.isArray(fila.ausencias)) {
    return {
      ...fila,
      ausencias: fila.ausencias.filter((item) => esDeRoster(item, roster)),
    };
  }
  return resultado;
}
