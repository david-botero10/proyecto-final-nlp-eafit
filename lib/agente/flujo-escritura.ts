import { auditarPropuesta } from "@/lib/a2a/cliente";
import { fechaIsoBogota } from "@/lib/agente/fechas";
import { llamarHerramienta } from "@/lib/agente/mcp";
import { crearCliente } from "@/lib/db/cliente";
import {
  equipoAcotado,
  mensajePropuestaFuera,
  type PerfilAlcance,
} from "@/lib/guardrails/alcance";
import { vincularPropuesta } from "@/lib/memoria/conversaciones";
import {
  atributosAgente,
  atributosLlm,
  conSpan,
} from "@/lib/observabilidad/spans";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import { guardarVeredicto } from "@/mcp/escrituras";
import type { Accion, Extraccion, Propuesta, TipoAusencia, VeredictoAuditor } from "@/lib/tipos";
import { extraerOrden, type OpcionesExtraccion } from "./extraccion";

export type EmpleadoBreve = {
  id: number;
  nombre: string;
  equipo?: string;
};

export type EntradaCrearFlujo = {
  orden_texto: string;
  extraccion: Extraccion;
  acciones: Accion[];
};

export type ResultadoOrden =
  | { ok: true; propuesta: Propuesta; texto: string }
  | { ok: false; texto: string };

export type DepsFlujo = {
  hoy?: string;
  /** Auditor A2A. Sustituible en tests; `null` = sin auditar. */
  auditar?: (propuesta: Propuesta) => Promise<VeredictoAuditor | null>;
  extraer?: (orden: string, fecha: string) => Promise<Extraccion>;
  opcionesExtraccion?: OpcionesExtraccion;
  leerEmpleados?: () => Promise<EmpleadoBreve[] | { error: string }>;
  leerTurnos?: (
    desde: string,
    hasta: string,
    empleadoId: number,
  ) => Promise<unknown>;
  leerAusencias?: (
    desde: string,
    hasta: string,
    empleadoId: number,
  ) => Promise<unknown>;
  crear?: (entrada: EntradaCrearFlujo) => Promise<Propuesta | { error: string }>;
  perfil?: PerfilAlcance | null;
  conversacionId?: string | null;
  vincular?: (propuestaId: string) => Promise<void>;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(texto: string): string[] {
  return normalizar(texto).split(" ").filter((token) => token.length > 0);
}

export function resolverEmpleado(
  consulta: string,
  empleados: EmpleadoBreve[],
): { id: number } | { error: string } {
  const pedidos = tokens(consulta);
  if (pedidos.length === 0) {
    return { error: "La orden no trae el nombre del empleado." };
  }
  const exactos = empleados.filter(
    (empleado) => tokens(empleado.nombre).join(" ") === pedidos.join(" "),
  );
  const coinciden =
    exactos.length > 0
      ? exactos
      : empleados.filter((empleado) => {
          const suyos = tokens(empleado.nombre);
          return pedidos.every((token) => suyos.includes(token));
        });
  if (coinciden.length === 1) {
    return { id: coinciden[0].id };
  }
  if (coinciden.length === 0) {
    return {
      error: `No encontré un empleado activo que coincida con «${consulta}».`,
    };
  }
  const lista = coinciden.map((empleado) => empleado.nombre).join(", ");
  return {
    error: `Hay varios empleados activos que coinciden con «${consulta}»: ${lista}. Precisa el nombre.`,
  };
}

export function tipoAusencia(texto: string): TipoAusencia {
  const plano = normalizar(texto);
  if (plano.includes("incapacit")) {
    return "incapacidad";
  }
  if (plano.includes("vacacion")) {
    return "vacaciones";
  }
  if (plano.includes("licencia")) {
    return "licencia";
  }
  return "permiso";
}

export function accionesDesdeExtraccion(
  extraccion: Extraccion,
  empleadoId: number,
  ordenTexto: string,
): Accion[] | { error: string } {
  if (extraccion.fechas.length === 0) {
    return { error: "La orden no trae fechas." };
  }
  if (extraccion.accion === "asignar") {
    if (!extraccion.turno) {
      return { error: "La orden de turno no trae mañana, tarde o noche." };
    }
    const turno = extraccion.turno;
    return extraccion.fechas.map((fecha) => ({
      tipo: "asignar_turno" as const,
      empleado_id: empleadoId,
      turno,
      fecha,
    }));
  }
  if (extraccion.accion === "quitar") {
    return extraccion.fechas.map((fecha) => ({
      tipo: "cancelar_turno" as const,
      empleado_id: empleadoId,
      fecha,
    }));
  }
  const ordenadas = [...extraccion.fechas].sort();
  return [
    {
      tipo: "registrar_ausencia",
      empleado_id: empleadoId,
      tipo_ausencia: tipoAusencia(
        `${ordenTexto} ${extraccion.justificacion ?? ""}`,
      ),
      fecha_inicio: ordenadas[0],
      fecha_fin: ordenadas[ordenadas.length - 1],
      motivo: extraccion.justificacion,
    },
  ];
}

export function textoPropuesta(cantidad: number): string {
  const cambios = cantidad === 1 ? "este cambio" : `estos ${cantidad} cambios`;
  return `Te propongo ${cambios} a partir de tu orden. Revisa la tarjeta: nada se escribe en la nómina hasta que apruebes, corrijas o rechaces.`;
}

function esError(valor: unknown): valor is { error: string } {
  if (!valor || typeof valor !== "object" || !("error" in valor)) {
    return false;
  }
  if ("propuesta_id" in valor) {
    return false;
  }
  return typeof valor.error === "string";
}

function mensajeSeguro(error: unknown): string {
  const texto = error instanceof Error ? error.message : "";
  if (/password|postgresql:\/\/|XAI_API_KEY/i.test(texto)) {
    return "No se pudo preparar la propuesta.";
  }
  return texto.length > 0 ? texto : "No se pudo preparar la propuesta.";
}

async function empleadosPorDefecto(): Promise<EmpleadoBreve[] | { error: string }> {
  const resultado = await llamarHerramienta("listar_empleados", { activo: true });
  if (esError(resultado)) {
    return resultado;
  }
  const empleados = (resultado as { empleados?: unknown }).empleados;
  if (!Array.isArray(empleados)) {
    return { error: "No se pudo consultar los empleados." };
  }
  return empleados.flatMap((fila) => {
    if (!fila || typeof fila !== "object") {
      return [];
    }
    const empleado = fila as { id?: unknown; nombre?: unknown; equipo?: unknown };
    if (typeof empleado.id !== "number" || typeof empleado.nombre !== "string") {
      return [];
    }
    return [
      {
        id: empleado.id,
        nombre: empleado.nombre,
        equipo: typeof empleado.equipo === "string" ? empleado.equipo : undefined,
      },
    ];
  });
}

async function turnosPorDefecto(
  desde: string,
  hasta: string,
  empleadoId: number,
): Promise<unknown> {
  return llamarHerramienta("consultar_turnos", {
    empleado: empleadoId,
    desde,
    hasta,
  });
}

async function ausenciasPorDefecto(
  desde: string,
  hasta: string,
  empleadoId: number,
): Promise<unknown> {
  return llamarHerramienta("consultar_ausencias", {
    empleado: empleadoId,
    desde,
    hasta,
  });
}

async function crearPorDefecto(
  entrada: EntradaCrearFlujo,
): Promise<Propuesta | { error: string }> {
  const resultado = await llamarHerramienta("crear_propuesta", { ...entrada });
  if (esError(resultado)) {
    return resultado;
  }
  return resultado as Propuesta;
}

/**
 * Pide el veredicto al auditor A2A y lo persiste en la propuesta.
 * Si el auditor no responde, la tarjeta sale «sin auditar» (nunca bloquea).
 */
async function auditarPorDefecto(
  propuesta: Propuesta,
): Promise<VeredictoAuditor | null> {
  const veredicto = await auditarPropuesta(propuesta);
  if (!veredicto) {
    return null;
  }
  const { sql, cerrar } = crearCliente();
  try {
    await guardarVeredicto(sql, propuesta.propuesta_id, veredicto);
  } catch {
    // El veredicto igual viaja a la tarjeta; la persistencia es best-effort.
  } finally {
    await cerrar();
  }
  return veredicto;
}

/** Extrae, valida con lecturas y deja la propuesta pendiente. */
export async function procesarOrdenEscritura(
  ordenTexto: string,
  deps?: DepsFlujo,
): Promise<ResultadoOrden> {
  const hoy = deps?.hoy ?? fechaIsoBogota();
  try {
    const extraccion = await conSpan(
      "relevo.extraccion",
      atributosLlm(ordenTexto),
      async (span) => {
        const obtenida = deps?.extraer
          ? await deps.extraer(ordenTexto, hoy)
          : await extraerOrden(ordenTexto, hoy, deps?.opcionesExtraccion);
        span.setAttribute("proveedor", obtenida.proveedor);
        span.setAttribute(SemanticConventions.OUTPUT_VALUE, obtenida.proveedor);
        return obtenida;
      },
    );
    const accionesOError = accionesDesdeExtraccion(
      extraccion,
      0,
      ordenTexto,
    );
    if (!Array.isArray(accionesOError)) {
      return { ok: false, texto: accionesOError.error };
    }

    const leidos = deps?.leerEmpleados
      ? await deps.leerEmpleados()
      : await empleadosPorDefecto();
    if (esError(leidos)) {
      return { ok: false, texto: leidos.error };
    }
    const resuelto = resolverEmpleado(extraccion.empleado, leidos);
    if ("error" in resuelto) {
      return { ok: false, texto: resuelto.error };
    }
    const acotado = equipoAcotado(deps?.perfil);
    if (acotado) {
      const elegido = leidos.find((empleado) => empleado.id === resuelto.id);
      if (elegido?.equipo && elegido.equipo !== acotado) {
        return {
          ok: false,
          texto: mensajePropuestaFuera(acotado, elegido.nombre, elegido.equipo),
        };
      }
    }
    const acciones = accionesOError.map((accion) => ({
      ...accion,
      empleado_id: resuelto.id,
    }));
    const fechas = acciones.flatMap((accion) =>
      accion.tipo === "registrar_ausencia"
        ? [accion.fecha_inicio, accion.fecha_fin]
        : [accion.fecha],
    );
    const desde = [...fechas].sort()[0];
    const hasta = [...fechas].sort().at(-1) ?? desde;

    const turnos = deps?.leerTurnos
      ? await deps.leerTurnos(desde, hasta, resuelto.id)
      : await turnosPorDefecto(desde, hasta, resuelto.id);
    if (esError(turnos)) {
      return { ok: false, texto: turnos.error };
    }
    const ausencias = deps?.leerAusencias
      ? await deps.leerAusencias(desde, hasta, resuelto.id)
      : await ausenciasPorDefecto(desde, hasta, resuelto.id);
    if (esError(ausencias)) {
      return { ok: false, texto: ausencias.error };
    }

    const creada = deps?.crear
      ? await deps.crear({ orden_texto: ordenTexto, extraccion, acciones })
      : await crearPorDefecto({ orden_texto: ordenTexto, extraccion, acciones });
    if (esError(creada)) {
      return { ok: false, texto: creada.error };
    }
    if (deps?.conversacionId) {
      try {
        if (deps.vincular) {
          await deps.vincular(creada.propuesta_id);
        } else {
          const { sql, cerrar } = crearCliente();
          try {
            await vincularPropuesta(sql, creada.propuesta_id, deps.conversacionId);
          } finally {
            await cerrar();
          }
        }
      } catch {
        // La tarjeta no depende de que el hilo quede enlazado.
      }
    }
    let veredicto: VeredictoAuditor | null = null;
    try {
      veredicto = await conSpan(
        "relevo.auditoria",
        {
          ...atributosAgente(ordenTexto),
          propuesta_id: creada.propuesta_id,
        },
        async (span) => {
          const obtenido = deps?.auditar
            ? await deps.auditar(creada)
            : await auditarPorDefecto(creada);
          span.setAttribute("veredicto", obtenido?.veredicto ?? "sin_auditar");
          span.setAttribute(
            SemanticConventions.OUTPUT_VALUE,
            obtenido?.veredicto ?? "sin_auditar",
          );
          return obtenido;
        },
      );
    } catch {
      veredicto = null;
    }
    const propuesta: Propuesta = { ...creada, veredicto_auditor: veredicto };
    return {
      ok: true,
      propuesta,
      texto: textoPropuesta(propuesta.acciones.length),
    };
  } catch (error) {
    return { ok: false, texto: mensajeSeguro(error) };
  }
}
