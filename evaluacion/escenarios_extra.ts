/**
 * Diez trampas nuevas. Las etiquetas describen lo que el auditor de D2
 * hace hoy con el seed, no un ideal distinto. El seed no tiene empleados
 * con activo=false: el caso «no activo» usa un id fuera del catálogo.
 */
import type { PropuestaAuditable } from "../lib/a2a/cliente";
import type { Extraccion, Turno } from "../lib/tipos";
import { EMPLEADO_ROTATIVO } from "../tests/auditor/ayuda";
import type { EscenarioMedible } from "./escenarios_d2";

const VACIO = { solapes_detectados: [], ausencias_en_rango: [] };

function extraccion(
  empleado: string,
  turno: Turno | null,
  fechas: string[],
  accion: Extraccion["accion"],
): Extraccion {
  return {
    empleado,
    turno,
    fechas,
    justificacion: null,
    accion,
    proveedor: "xai",
  };
}

function asignar(
  id: string,
  empleadoId: number,
  empleado: string,
  turno: Turno,
  fecha: string,
  orden: string,
): PropuestaAuditable {
  return {
    propuesta_id: id,
    orden_texto: orden,
    extraccion: extraccion(empleado, turno, [fecha], "asignar"),
    acciones: [
      { tipo: "asignar_turno", empleado_id: empleadoId, turno, fecha },
    ],
    contexto: VACIO,
  };
}

export function escenariosExtra(): EscenarioMedible[] {
  return [
    {
      id: "f1-festivo-trasladado",
      titulo: "festivo trasladado (Reyes Magos, lunes 12 de enero)",
      origen: "f1",
      esperado: "observaciones",
      propuesta: asignar(
        "f1-festivo-trasladado",
        EMPLEADO_ROTATIVO,
        "Elizabeth María López",
        "M",
        "2026-01-12",
        "Ponle la mañana el lunes 12 de enero, que es el puente de Reyes.",
      ),
    },
    {
      id: "f1-reyes-calendario",
      titulo: "6 de enero no es el festivo trasladado",
      origen: "f1",
      esperado: "aprobado",
      propuesta: asignar(
        "f1-reyes-calendario",
        EMPLEADO_ROTATIVO,
        "Elizabeth María López",
        "M",
        "2026-01-06",
        "Ponle la mañana el 6 de enero, el día de Reyes en el calendario.",
      ),
    },
    {
      id: "f1-ausencia-cruza-semanas",
      titulo: "ausencia que cruza dos semanas y pisa turnos",
      origen: "f1",
      esperado: "rechazado",
      propuesta: {
        propuesta_id: "f1-ausencia-cruza-semanas",
        orden_texto: "Vacaciones del domingo 9 al lunes 10 de agosto.",
        extraccion: extraccion(
          "Elizabeth María López",
          null,
          ["2026-08-09", "2026-08-10"],
          "ausencia",
        ),
        acciones: [
          {
            tipo: "registrar_ausencia",
            empleado_id: EMPLEADO_ROTATIVO,
            tipo_ausencia: "vacaciones",
            fecha_inicio: "2026-08-09",
            fecha_fin: "2026-08-10",
            motivo: "cruza la semana",
          },
        ],
        contexto: VACIO,
      },
    },
    {
      id: "f1-noche-hacia-domingo",
      titulo: "noche del sábado que amanece en domingo",
      origen: "f1",
      esperado: "observaciones",
      propuesta: asignar(
        "f1-noche-hacia-domingo",
        EMPLEADO_ROTATIVO,
        "Elizabeth María López",
        "N",
        "2026-10-03",
        "Ponle la noche del sábado 3 de octubre, que sale el domingo en la mañana.",
      ),
    },
    {
      id: "f1-no-activo",
      titulo: "id fuera del catálogo de activos",
      origen: "f1",
      esperado: "rechazado",
      propuesta: asignar(
        "f1-no-activo",
        999_998,
        "Empleado inactivo sintético",
        "M",
        "2026-09-30",
        "Asigna la mañana del 30 de septiembre a un empleado que no está activo.",
      ),
    },
    {
      id: "f1-dos-turnos",
      titulo: "dos turnos el mismo día en una sola propuesta",
      origen: "f1",
      esperado: "rechazado",
      propuesta: {
        propuesta_id: "f1-dos-turnos",
        orden_texto: "El 30 de septiembre ponle mañana y también tarde.",
        extraccion: extraccion(
          "Elizabeth María López",
          "M",
          ["2026-09-30"],
          "asignar",
        ),
        acciones: [
          {
            tipo: "asignar_turno",
            empleado_id: EMPLEADO_ROTATIVO,
            turno: "M",
            fecha: "2026-09-30",
          },
          {
            tipo: "asignar_turno",
            empleado_id: EMPLEADO_ROTATIVO,
            turno: "T",
            fecha: "2026-09-30",
          },
        ],
        contexto: VACIO,
      },
    },
    {
      id: "f1-pasa-44",
      titulo: "la semana de Mónica queda en 48 horas",
      origen: "f1",
      esperado: "observaciones",
      propuesta: asignar(
        "f1-pasa-44",
        12,
        "Mónica Vargas Restrepo",
        "M",
        "2026-08-08",
        "Súmale la mañana del sábado 8 de agosto a Mónica, que ya tiene cinco noches.",
      ),
    },
    {
      id: "f1-reemplazo",
      titulo: "cancelar el domingo y caer en la incapacidad del lunes",
      origen: "f1",
      esperado: "rechazado",
      propuesta: {
        propuesta_id: "f1-reemplazo",
        orden_texto: "Quítale a Blanca el domingo 16 y ponle la mañana del lunes 10.",
        extraccion: extraccion(
          "Blanca Becerra",
          "M",
          ["2026-08-10", "2026-08-16"],
          "quitar",
        ),
        acciones: [
          {
            tipo: "cancelar_turno",
            empleado_id: 3,
            fecha: "2026-08-16",
          },
          {
            tipo: "asignar_turno",
            empleado_id: 3,
            turno: "M",
            fecha: "2026-08-10",
          },
        ],
        contexto: VACIO,
      },
    },
    {
      id: "f1-noche-domingo",
      titulo: "noche en domingo",
      origen: "f1",
      esperado: "observaciones",
      propuesta: asignar(
        "f1-noche-domingo",
        EMPLEADO_ROTATIVO,
        "Elizabeth María López",
        "N",
        "2026-11-01",
        "Ponle la noche del domingo 1 de noviembre.",
      ),
    },
    {
      id: "f1-ausencia-sin-turno",
      titulo: "ausencia que cruza dos semanas sin pisar turnos",
      origen: "f1",
      esperado: "aprobado",
      propuesta: {
        propuesta_id: "f1-ausencia-sin-turno",
        orden_texto: "Vacaciones del sábado 3 al lunes 5 de octubre.",
        extraccion: extraccion(
          "Elizabeth María López",
          null,
          ["2026-10-03", "2026-10-05"],
          "ausencia",
        ),
        acciones: [
          {
            tipo: "registrar_ausencia",
            empleado_id: EMPLEADO_ROTATIVO,
            tipo_ausencia: "vacaciones",
            fecha_inicio: "2026-10-03",
            fecha_fin: "2026-10-05",
            motivo: "puente sin turnos",
          },
        ],
        contexto: VACIO,
      },
    },
  ];
}
