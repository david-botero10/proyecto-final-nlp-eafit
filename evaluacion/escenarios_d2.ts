/**
 * Los 10 escenarios de D2, rearmados con los fixtures de
 * `tests/auditor/ayuda.ts` para volver a medirlos sin editar esa ola.
 */
import type { PropuestaAuditable } from "../lib/a2a/cliente";
import type { Veredicto } from "../lib/tipos";
import {
  EMPLEADO_INCAPACIDAD,
  EMPLEADO_ROTATIVO,
  propuestaTurno,
} from "../tests/auditor/ayuda";

export type EscenarioMedible = {
  id: string;
  titulo: string;
  origen: "d2" | "f1";
  esperado: Veredicto;
  propuesta: PropuestaAuditable;
};

const VACIO = { solapes_detectados: [], ausencias_en_rango: [] };

export function escenariosD2(): EscenarioMedible[] {
  return [
    {
      id: "p-inexistente",
      titulo: "empleado inexistente",
      origen: "d2",
      esperado: "rechazado",
      propuesta: propuestaTurno({
        id: "p-inexistente",
        empleadoId: 999_999,
        turno: "M",
        fecha: "2026-09-28",
      }),
    },
    {
      id: "p-duplicado",
      titulo: "turno duplicado el mismo día",
      origen: "d2",
      esperado: "rechazado",
      propuesta: propuestaTurno({
        id: "p-duplicado",
        turno: "M",
        fecha: "2026-08-03",
        orden: "Ponle la mañana el lunes 3 de agosto, aunque ya tiene tarde.",
      }),
    },
    {
      id: "p-ausencia",
      titulo: "turno dentro de una ausencia aprobada",
      origen: "d2",
      esperado: "rechazado",
      propuesta: propuestaTurno({
        id: "p-ausencia",
        empleadoId: EMPLEADO_INCAPACIDAD,
        turno: "M",
        fecha: "2026-08-05",
        orden: "Asignar mañana durante la incapacidad aprobada.",
      }),
    },
    {
      id: "p-domingo",
      titulo: "asignación en domingo",
      origen: "d2",
      esperado: "observaciones",
      propuesta: propuestaTurno({
        id: "p-domingo",
        turno: "M",
        fecha: "2026-10-04",
        orden: "Ponle la mañana el domingo 4 de octubre.",
      }),
    },
    {
      id: "p-festivo",
      titulo: "asignación en festivo 2026-10-12",
      origen: "d2",
      esperado: "observaciones",
      propuesta: propuestaTurno({
        id: "p-festivo",
        turno: "T",
        fecha: "2026-10-12",
        orden: "Cubre el festivo del 12 de octubre en la tarde.",
      }),
    },
    {
      id: "p-noche",
      titulo: "turno noche",
      origen: "d2",
      esperado: "observaciones",
      propuesta: propuestaTurno({
        id: "p-noche",
        turno: "N",
        fecha: "2026-09-29",
        orden: "Ponle el turno de la noche el martes 29 de septiembre.",
      }),
    },
    {
      id: "p-septimo",
      titulo: "séptimo día de la semana",
      origen: "d2",
      esperado: "observaciones",
      propuesta: propuestaTurno({
        id: "p-septimo",
        turno: "M",
        fecha: "2026-08-08",
        orden: "Cubre también el sábado 8 de agosto.",
      }),
    },
    {
      id: "p-ausencia-turnos",
      titulo: "ausencia sobre días con turnos activos",
      origen: "d2",
      esperado: "rechazado",
      propuesta: {
        propuesta_id: "p-ausencia-turnos",
        orden_texto: "Registra vacaciones del 3 al 5 de agosto.",
        extraccion: {
          empleado: "Elizabeth María López",
          turno: "M",
          fechas: ["2026-08-03", "2026-08-04", "2026-08-05"],
          justificacion: "vacaciones",
          accion: "ausencia",
          proveedor: "xai",
        },
        acciones: [
          {
            tipo: "registrar_ausencia",
            empleado_id: EMPLEADO_ROTATIVO,
            tipo_ausencia: "vacaciones",
            fecha_inicio: "2026-08-03",
            fecha_fin: "2026-08-05",
            motivo: "descanso",
          },
        ],
        contexto: VACIO,
      },
    },
    {
      id: "p-limpia",
      titulo: "propuesta limpia",
      origen: "d2",
      esperado: "aprobado",
      propuesta: propuestaTurno({
        id: "p-limpia",
        turno: "M",
        fecha: "2026-09-28",
        orden: "Ponle la mañana el lunes 28 de septiembre.",
      }),
    },
    {
      id: "p-mixta",
      titulo: "una acción limpia y otra en domingo",
      origen: "d2",
      esperado: "observaciones",
      propuesta: {
        propuesta_id: "p-mixta",
        orden_texto: "Mañana el lunes 28 y también el domingo 4.",
        extraccion: {
          empleado: "Elizabeth María López",
          turno: "M",
          fechas: ["2026-09-28", "2026-10-04"],
          justificacion: null,
          accion: "asignar",
          proveedor: "xai",
        },
        acciones: [
          {
            tipo: "asignar_turno",
            empleado_id: EMPLEADO_ROTATIVO,
            turno: "M",
            fecha: "2026-09-28",
          },
          {
            tipo: "asignar_turno",
            empleado_id: EMPLEADO_ROTATIVO,
            turno: "M",
            fecha: "2026-10-04",
          },
        ],
        contexto: VACIO,
      },
    },
  ];
}
