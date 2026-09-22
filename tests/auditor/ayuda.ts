import type { PropuestaAuditable as Propuesta } from "@/lib/a2a/cliente";
import type { Turno, VeredictoAuditor } from "@/lib/tipos";

/** Empleado 2 del seed: Elizabeth María López, activo. */
export const EMPLEADO_ROTATIVO = 2;

/** Empleado 11: incapacidad aprobada 2026-08-03 a 2026-08-07, sin turno el 08-05. */
export const EMPLEADO_INCAPACIDAD = 11;

export function propuestaTurno(parcial: {
  id: string;
  empleadoId?: number;
  turno: Turno;
  fecha: string;
  orden?: string;
}): Propuesta {
  const empleadoId = parcial.empleadoId ?? EMPLEADO_ROTATIVO;
  return {
    propuesta_id: parcial.id,
    orden_texto:
      parcial.orden ??
      `Asignar el turno ${parcial.turno} el ${parcial.fecha}.`,
    extraccion: {
      empleado: "Elizabeth María López",
      turno: parcial.turno,
      fechas: [parcial.fecha],
      justificacion: null,
      accion: "asignar",
      proveedor: "xai",
    },
    acciones: [
      {
        tipo: "asignar_turno",
        empleado_id: empleadoId,
        turno: parcial.turno,
        fecha: parcial.fecha,
      },
    ],
    contexto: { solapes_detectados: [], ausencias_en_rango: [] },
  };
}

export function citaArticulo(
  veredicto: VeredictoAuditor,
  articulo: string,
): boolean {
  return veredicto.normas_citadas.some(
    (norma) =>
      norma.articulo === articulo &&
      norma.chunk_id > 0 &&
      norma.fuente.length > 0,
  );
}
