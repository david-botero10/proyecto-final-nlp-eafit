import type { NormaCitada } from "../lib/tipos";
import {
  cadaDia,
  esDomingo,
  lunesDe,
  sumarDias,
} from "../lib/a2a/fechas";
import type {
  AccionAuditoria,
  SolicitudAuditoria,
} from "../lib/a2a/esquemas";
import { nombreFestivo } from "./festivos";
import {
  DIAS_SEMANA_MAXIMOS,
  formatearHoras,
  HORAS_SEMANA_MAXIMAS,
  MARGEN_CERCA_HORAS,
} from "./horas";
import { horasDeTurno, obtenerClienteAuditor } from "./mcp";
import type { Hallazgos } from "./veredicto";

type Tema = "dominical" | "festivo" | "nocturno" | "jornada";

type TurnoCodigo = "M" | "T" | "N";

type Asignacion = {
  fecha: string;
  turno: string;
  estado: string;
};

type Ausencia = {
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
};

const ORDEN_TEMAS: Tema[] = ["dominical", "festivo", "nocturno", "jornada"];

const CONSULTA_NORMA: Record<Tema, { consulta: string; articulo: string }> = {
  dominical: {
    consulta: "recargo dominical descanso domingo articulo 179",
    articulo: "179",
  },
  festivo: {
    consulta: "dias de fiesta descanso obligatorio",
    articulo: "179",
  },
  nocturno: {
    consulta: "recargo nocturno trabajo nocturno",
    articulo: "168",
  },
  jornada: {
    consulta: "jornada maxima semanal horas",
    articulo: "161",
  },
};

function idsEmpleados(acciones: AccionAuditoria[]): number[] {
  return [...new Set(acciones.map((accion) => accion.empleado_id))];
}

function esTurno(valor: string): valor is TurnoCodigo {
  return valor === "M" || valor === "T" || valor === "N";
}

function fechaCorta(valor: unknown): string {
  return String(valor ?? "").slice(0, 10);
}

function exigirObjeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new Error("Respuesta MCP inesperada.");
  }
  const registro = valor as Record<string, unknown>;
  if (typeof registro.error === "string") {
    throw new Error("No se pudo consultar la base de datos.");
  }
  return registro;
}

function exigirLista(
  valor: unknown,
  clave: string,
): Record<string, unknown>[] {
  const registro = exigirObjeto(valor);
  const lista = registro[clave];
  if (!Array.isArray(lista)) {
    throw new Error("Respuesta MCP inesperada.");
  }
  return lista.filter(
    (fila): fila is Record<string, unknown> =>
      !!fila && typeof fila === "object" && !Array.isArray(fila),
  );
}

function semanasDe(acciones: AccionAuditoria[], empleadoId: number): string[] {
  const luneses = new Set<string>();
  for (const accion of acciones) {
    if (accion.empleado_id !== empleadoId) {
      continue;
    }
    if (accion.tipo === "registrar_ausencia") {
      let lunes = lunesDe(accion.fecha_inicio);
      const fin = lunesDe(accion.fecha_fin);
      while (lunes <= fin && luneses.size < 16) {
        luneses.add(lunes);
        lunes = sumarDias(lunes, 7);
      }
      continue;
    }
    luneses.add(lunesDe(accion.fecha));
  }
  return [...luneses].sort();
}

async function leerAsignaciones(
  empleadoId: number,
  lunes: string,
): Promise<Asignacion[]> {
  const cliente = await obtenerClienteAuditor("solapes");
  const datos = await cliente.llamar("consultar_turnos", {
    empleado: empleadoId,
    desde: lunes,
    hasta: sumarDias(lunes, 6),
  });
  return exigirLista(datos, "asignaciones").map((fila) => ({
    fecha: fechaCorta(fila.fecha),
    turno: String(fila.turno ?? "").trim(),
    estado: String(fila.estado ?? ""),
  }));
}

async function leerAusencias(
  empleadoId: number,
  lunes: string,
): Promise<Ausencia[]> {
  const cliente = await obtenerClienteAuditor("solapes");
  const datos = await cliente.llamar("consultar_ausencias", {
    empleado: empleadoId,
    desde: lunes,
    hasta: sumarDias(lunes, 6),
  });
  return exigirLista(datos, "ausencias").map((fila) => ({
    fecha_inicio: fechaCorta(fila.fecha_inicio),
    fecha_fin: fechaCorta(fila.fecha_fin),
    estado: String(fila.estado ?? ""),
  }));
}

async function revisarEmpleados(ids: number[]): Promise<{
  ok: boolean;
  razones: string[];
}> {
  const cliente = await obtenerClienteAuditor("empleados");
  const datos = await cliente.llamar("listar_empleados", { activo: true });
  const activos = new Set(
    exigirLista(datos, "empleados").map((fila) => Number(fila.id)),
  );
  const razones: string[] = [];
  for (const id of ids) {
    if (!activos.has(id)) {
      razones.push(`El empleado ${id} no existe o no está activo.`);
    }
  }
  return { ok: razones.length === 0, razones };
}

function cubre(ausencia: Ausencia, fecha: string): boolean {
  return (
    ausencia.estado === "aprobada" &&
    ausencia.fecha_inicio <= fecha &&
    ausencia.fecha_fin >= fecha
  );
}

async function revisarSolapes(solicitud: SolicitudAuditoria): Promise<{
  ok: boolean;
  razones: string[];
  observacion: boolean;
  temas: Tema[];
}> {
  const razonesDuras: string[] = [];
  const razonesObservacion: string[] = [];
  const temas = new Set<Tema>();
  let observacion = false;

  for (const empleadoId of idsEmpleados(solicitud.acciones)) {
    const asignaciones: Asignacion[] = [];
    const ausencias: Ausencia[] = [];
    for (const lunes of semanasDe(solicitud.acciones, empleadoId)) {
      asignaciones.push(...(await leerAsignaciones(empleadoId, lunes)));
      ausencias.push(...(await leerAusencias(empleadoId, lunes)));
    }

    const proyeccion = new Map<string, string[]>();
    for (const asignacion of asignaciones) {
      if (asignacion.estado === "cancelada") {
        continue;
      }
      const lista = proyeccion.get(asignacion.fecha) ?? [];
      lista.push(asignacion.turno);
      proyeccion.set(asignacion.fecha, lista);
    }

    for (const accion of solicitud.acciones) {
      if (
        accion.tipo === "cancelar_turno" &&
        accion.empleado_id === empleadoId
      ) {
        proyeccion.delete(accion.fecha);
      }
    }

    const aprobadas = ausencias.filter((ausencia) => ausencia.estado === "aprobada");

    for (const accion of solicitud.acciones) {
      if (accion.tipo !== "asignar_turno" || accion.empleado_id !== empleadoId) {
        continue;
      }
      const ya = proyeccion.get(accion.fecha) ?? [];
      if (ya.length > 0) {
        razonesDuras.push(
          `El ${accion.fecha} el empleado ${empleadoId} ya tiene un turno activo.`,
        );
      }
      if (aprobadas.some((ausencia) => cubre(ausencia, accion.fecha))) {
        razonesDuras.push(
          `El ${accion.fecha} el empleado ${empleadoId} tiene una ausencia aprobada.`,
        );
      }
      if (esDomingo(accion.fecha)) {
        razonesObservacion.push(
          `El ${accion.fecha} es domingo: aplica recargo dominical.`,
        );
        temas.add("dominical");
        observacion = true;
      }
      const festivo = nombreFestivo(accion.fecha);
      if (festivo) {
        razonesObservacion.push(
          `El ${accion.fecha} es festivo (${festivo}): aplica recargo de día de fiesta.`,
        );
        temas.add("festivo");
        observacion = true;
      }
      if (accion.turno === "N") {
        razonesObservacion.push(
          `El turno noche del ${accion.fecha} genera recargo nocturno.`,
        );
        temas.add("nocturno");
        observacion = true;
      }
      // El turno de noche cuenta en la fecha de la asignación, aunque cruce la medianoche.
      const lista = proyeccion.get(accion.fecha) ?? [];
      lista.push(accion.turno);
      proyeccion.set(accion.fecha, lista);
    }

    for (const accion of solicitud.acciones) {
      if (
        accion.tipo !== "registrar_ausencia" ||
        accion.empleado_id !== empleadoId
      ) {
        continue;
      }
      const chocan = cadaDia(accion.fecha_inicio, accion.fecha_fin).filter(
        (fecha) => (proyeccion.get(fecha) ?? []).length > 0,
      );
      if (chocan.length > 0) {
        razonesDuras.push(
          `La ausencia del ${accion.fecha_inicio} al ${accion.fecha_fin} cubre turnos activos del empleado ${empleadoId}.`,
        );
      }
    }
  }

  return {
    ok: razonesDuras.length === 0,
    razones: [...razonesDuras, ...razonesObservacion],
    observacion,
    temas: [...temas],
  };
}

async function leerTurnosJornada(
  empleadoId: number,
  lunes: string,
): Promise<Asignacion[]> {
  const cliente = await obtenerClienteAuditor("jornada");
  const datos = await cliente.llamar("consultar_turnos", {
    empleado: empleadoId,
    desde: lunes,
    hasta: sumarDias(lunes, 6),
  });
  return exigirLista(datos, "asignaciones").map((fila) => ({
    fecha: fechaCorta(fila.fecha),
    turno: String(fila.turno ?? "").trim(),
    estado: String(fila.estado ?? ""),
  }));
}

function proyectarSemana(
  solicitud: SolicitudAuditoria,
  empleadoId: number,
  asignaciones: Asignacion[],
): Map<string, TurnoCodigo[]> {
  const proyeccion = new Map<string, TurnoCodigo[]>();
  for (const asignacion of asignaciones) {
    if (asignacion.estado === "cancelada" || !esTurno(asignacion.turno)) {
      continue;
    }
    const lista = proyeccion.get(asignacion.fecha) ?? [];
    lista.push(asignacion.turno);
    proyeccion.set(asignacion.fecha, lista);
  }
  for (const accion of solicitud.acciones) {
    if (accion.tipo === "cancelar_turno" && accion.empleado_id === empleadoId) {
      proyeccion.delete(accion.fecha);
    }
  }
  for (const accion of solicitud.acciones) {
    if (accion.tipo !== "asignar_turno" || accion.empleado_id !== empleadoId) {
      continue;
    }
    const lista = proyeccion.get(accion.fecha) ?? [];
    lista.push(accion.turno);
    proyeccion.set(accion.fecha, lista);
  }
  return proyeccion;
}

async function revisarJornada(
  solicitud: SolicitudAuditoria,
  horasTurno: Map<string, number>,
): Promise<{
  ok: boolean;
  razones: string[];
  observacion: boolean;
  temas: Tema[];
}> {
  const razones: string[] = [];
  let ok = true;
  let observacion = false;
  const temas = new Set<Tema>();

  for (const empleadoId of idsEmpleados(solicitud.acciones)) {
    const semanas = semanasDe(solicitud.acciones, empleadoId);
    const asignaciones: Asignacion[] = [];
    for (const lunes of semanas) {
      asignaciones.push(...(await leerTurnosJornada(empleadoId, lunes)));
    }
    const proyeccion = proyectarSemana(solicitud, empleadoId, asignaciones);

    for (const lunes of semanas) {
      const domingo = sumarDias(lunes, 6);
      let dias = 0;
      let horas = 0;
      for (const [fecha, turnos] of proyeccion) {
        if (fecha < lunes || fecha > domingo || turnos.length === 0) {
          continue;
        }
        dias += 1;
        for (const turno of turnos) {
          const horasDelTurno = horasTurno.get(turno);
          if (horasDelTurno === undefined) {
            throw new Error(`El catálogo de turnos no incluye el código ${turno}.`);
          }
          horas += horasDelTurno;
        }
      }
      const excedeDias = dias > DIAS_SEMANA_MAXIMOS;
      const excedeHoras = horas > HORAS_SEMANA_MAXIMAS;
      if (excedeDias) {
        razones.push(
          `La semana del ${lunes} quedaría en ${dias} días asignados; el máximo es ${DIAS_SEMANA_MAXIMOS}.`,
        );
        ok = false;
        observacion = true;
        temas.add("jornada");
      }
      if (excedeHoras) {
        razones.push(
          `La semana del ${lunes} suma ${formatearHoras(horas)} horas; el máximo vigente es ${HORAS_SEMANA_MAXIMAS}.`,
        );
        ok = false;
        observacion = true;
        temas.add("jornada");
      }
      if (!excedeDias && !excedeHoras && dias === DIAS_SEMANA_MAXIMOS) {
        razones.push(
          `La semana del ${lunes} queda en ${DIAS_SEMANA_MAXIMOS} días, en el límite semanal.`,
        );
        observacion = true;
      }
      if (
        !excedeDias &&
        !excedeHoras &&
        horas > HORAS_SEMANA_MAXIMAS - MARGEN_CERCA_HORAS &&
        horas > 0
      ) {
        razones.push(
          `La semana del ${lunes} suma ${formatearHoras(horas)} horas, cerca del máximo de ${HORAS_SEMANA_MAXIMAS}.`,
        );
        observacion = true;
      }
    }
  }

  return { ok, razones, observacion, temas: [...temas] };
}

function articuloDe(ref: unknown): string {
  const texto = typeof ref === "string" ? ref : "";
  const coincidencia = texto.match(/\d+/);
  return coincidencia ? coincidencia[0] : texto || "s.f.";
}

function esCst(fuente: string): boolean {
  return fuente.toLowerCase().startsWith("cst");
}

type FilaNorma = {
  chunk_id: number;
  ref: string | null;
  fuente: string;
  fragmento: string;
};

function filaNorma(valor: Record<string, unknown>): FilaNorma | null {
  const chunkId = Number(valor.chunk_id);
  const fuente = typeof valor.fuente === "string" ? valor.fuente : "";
  if (!Number.isInteger(chunkId) || chunkId <= 0 || fuente.length === 0) {
    return null;
  }
  return {
    chunk_id: chunkId,
    ref: typeof valor.ref === "string" ? valor.ref : null,
    fuente,
    fragmento: typeof valor.fragmento === "string" ? valor.fragmento : "",
  };
}

function elegirCita(filas: FilaNorma[], articulo: string): NormaCitada | null {
  const delArticulo = filas.filter((fila) => articuloDe(fila.ref) === articulo);
  const preferida =
    delArticulo.find((fila) => esCst(fila.fuente)) ??
    delArticulo[0] ??
    filas[0];
  if (!preferida) {
    return null;
  }
  return {
    fuente: preferida.fuente,
    articulo: articuloDe(preferida.ref),
    chunk_id: preferida.chunk_id,
  };
}

async function citarTemas(temas: Tema[]): Promise<NormaCitada[]> {
  const cliente = await obtenerClienteAuditor("normas");
  const citas: NormaCitada[] = [];
  const vistos = new Set<number>();
  for (const tema of ORDEN_TEMAS) {
    if (!temas.includes(tema)) {
      continue;
    }
    const { consulta, articulo } = CONSULTA_NORMA[tema];
    const datos = await cliente.llamar("buscar_norma", { consulta, k: 8 });
    const filas = exigirLista(datos, "resultados").flatMap((fila) => {
      const norma = filaNorma(fila);
      return norma ? [norma] : [];
    });
    const cita = elegirCita(filas, articulo);
    if (cita && !vistos.has(cita.chunk_id)) {
      vistos.add(cita.chunk_id);
      citas.push(cita);
    }
  }
  return citas;
}

/** Verificaciones deterministas. Cada una usa su cliente MCP de solo lectura. */
export async function verificar(
  solicitud: SolicitudAuditoria,
): Promise<Hallazgos> {
  const horas = await horasDeTurno();
  const ids = idsEmpleados(solicitud.acciones);
  const [empleados, solapes, jornada] = await Promise.all([
    revisarEmpleados(ids),
    revisarSolapes(solicitud),
    revisarJornada(solicitud, horas),
  ]);
  const temas = ORDEN_TEMAS.filter(
    (tema) => solapes.temas.includes(tema) || jornada.temas.includes(tema),
  );
  const normas = await citarTemas(temas);
  return {
    empleado_existe: empleados.ok,
    sin_solapes: solapes.ok,
    jornada_dentro_de_limites: jornada.ok,
    razones: [...empleados.razones, ...solapes.razones, ...jornada.razones],
    normas_citadas: normas,
    hayObservacion: solapes.observacion || jornada.observacion,
  };
}
