import { z } from "zod";

const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "la fecha debe ser ISO (YYYY-MM-DD)");

const empleadoFiltro = z.union([z.number().int().positive(), z.string().min(1)]);

function diasEntre(desde: string, hasta: string): number {
  const utc = (fecha: string) =>
    Date.UTC(
      Number(fecha.slice(0, 4)),
      Number(fecha.slice(5, 7)) - 1,
      Number(fecha.slice(8, 10)),
    );
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

function conRangoFechas<T extends z.ZodRawShape>(forma: T) {
  return z.object(forma).superRefine((datos, ctx) => {
    const { desde, hasta } = datos as { desde: string; hasta: string };
    if (desde > hasta) {
      ctx.addIssue({
        code: "custom",
        message: "desde no puede ser posterior a hasta",
        path: ["desde"],
      });
    }
    if (diasEntre(desde, hasta) > 92) {
      ctx.addIssue({
        code: "custom",
        message: "el rango no puede superar 92 días",
        path: ["hasta"],
      });
    }
  });
}

export const listarEmpleadosEntrada = z.object({
  equipo: z.string().min(1).optional(),
  activo: z.boolean().optional(),
});

export const listarEmpleadosSalida = z.object({
  empleados: z.array(
    z.object({
      id: z.number().int(),
      nombre: z.string(),
      rol: z.string(),
      equipo: z.string(),
    }),
  ),
});

export const consultarTurnosEntrada = conRangoFechas({
  empleado: empleadoFiltro.optional(),
  desde: fechaIso,
  hasta: fechaIso,
  turno: z.enum(["M", "T", "N"]).optional(),
});

export const consultarTurnosSalida = z.object({
  asignaciones: z.array(
    z.object({
      empleado: z.string(),
      turno: z.string(),
      turno_nombre: z.string(),
      fecha: z.string(),
      estado: z.string(),
    }),
  ),
});

export const consultarAusenciasEntrada = conRangoFechas({
  empleado: empleadoFiltro.optional(),
  desde: fechaIso,
  hasta: fechaIso,
  tipo: z
    .enum(["vacaciones", "incapacidad", "permiso", "licencia"])
    .optional(),
});

export const consultarAusenciasSalida = z.object({
  ausencias: z.array(
    z.object({
      empleado: z.string(),
      tipo: z.string(),
      fecha_inicio: z.string(),
      fecha_fin: z.string(),
      estado: z.string(),
      motivo: z.string().nullable(),
    }),
  ),
});

export const buscarNormaEntrada = z.object({
  consulta: z.string().min(1),
  k: z.number().int().min(1).max(50).default(8),
});

export const buscarNormaSalida = z.object({
  modo: z.enum(["hibrida", "lexica"]),
  resultados: z.array(
    z.object({
      chunk_id: z.number().int(),
      ref: z.string().nullable(),
      fuente: z.string(),
      titulo: z.string(),
      url: z.string().nullable(),
      fragmento: z.string(),
      score: z.number(),
    }),
  ),
});

export type ListarEmpleadosEntrada = z.infer<typeof listarEmpleadosEntrada>;
export type ConsultarTurnosEntrada = z.infer<typeof consultarTurnosEntrada>;
export type ConsultarAusenciasEntrada = z.infer<typeof consultarAusenciasEntrada>;
export type BuscarNormaEntrada = z.infer<typeof buscarNormaEntrada>;

const turnoCodigo = z.enum(["M", "T", "N"]);

const tipoAusencia = z.enum([
  "vacaciones",
  "incapacidad",
  "permiso",
  "licencia",
]);

export const accionSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("asignar_turno"),
    empleado_id: z.number().int().positive(),
    turno: turnoCodigo,
    fecha: fechaIso,
  }),
  z.object({
    tipo: z.literal("registrar_ausencia"),
    empleado_id: z.number().int().positive(),
    tipo_ausencia: tipoAusencia,
    fecha_inicio: fechaIso,
    fecha_fin: fechaIso,
    motivo: z.string().nullable(),
  }),
  z.object({
    tipo: z.literal("cancelar_turno"),
    empleado_id: z.number().int().positive(),
    fecha: fechaIso,
  }),
]);

export const extraccionModeloSchema = z.object({
  empleado: z.string().min(1),
  turno: turnoCodigo.nullable(),
  fechas: z.array(fechaIso),
  justificacion: z.string().nullable(),
  accion: z.enum(["asignar", "ausencia", "quitar"]),
});

export const extraccionSchema = extraccionModeloSchema.extend({
  proveedor: z.enum(["xai", "lora"]),
});

const solapeSchema = z.object({
  empleado_id: z.number().int(),
  empleado: z.string(),
  fecha: fechaIso,
  turno: z.string(),
  estado: z.string(),
});

const ausenciaRangoSchema = z.object({
  empleado_id: z.number().int(),
  empleado: z.string(),
  tipo: z.string(),
  fecha_inicio: fechaIso,
  fecha_fin: fechaIso,
  estado: z.string(),
});

const veredictoSchema = z.object({
  propuesta_id: z.string(),
  veredicto: z.enum(["aprobado", "observaciones", "rechazado"]),
  razones: z.array(z.string()),
  normas_citadas: z.array(
    z.object({
      fuente: z.string(),
      articulo: z.string(),
      chunk_id: z.number().int(),
    }),
  ),
  verificaciones: z.object({
    empleado_existe: z.boolean(),
    sin_solapes: z.boolean(),
    jornada_dentro_de_limites: z.boolean(),
  }),
});

export const crearPropuestaEntrada = z.object({
  orden_texto: z.string().min(1),
  extraccion: extraccionSchema,
  acciones: z.array(accionSchema).min(1),
});

export const crearPropuestaSalida = z.object({
  propuesta_id: z.string(),
  estado: z.literal("pendiente"),
  usuario: z.string(),
  orden_texto: z.string(),
  extraccion: extraccionSchema,
  acciones: z.array(accionSchema).min(1),
  contexto: z.object({
    solapes_detectados: z.array(solapeSchema),
    ausencias_en_rango: z.array(ausenciaRangoSchema),
  }),
  veredicto_auditor: veredictoSchema.nullable(),
  nombres: z.array(
    z.object({
      id: z.number().int(),
      nombre: z.string(),
    }),
  ),
});

export const decisionEntrada = z
  .object({
    decision: z.enum(["aprobar", "corregir", "rechazar"]),
    correccion: z.array(accionSchema).optional(),
    usuario: z.string().min(1),
  })
  .superRefine((datos, ctx) => {
    if (
      datos.decision === "corregir" &&
      (!datos.correccion || datos.correccion.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "corregir exige correccion con al menos una acción",
        path: ["correccion"],
      });
    }
  });
