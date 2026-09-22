import { z } from "zod";
import { diasEntre } from "./fechas";

const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "la fecha debe ser ISO (YYYY-MM-DD)");

const turno = z.enum(["M", "T", "N"]);

const accionAsignar = z.object({
  tipo: z.literal("asignar_turno"),
  empleado_id: z.number().int().positive(),
  turno,
  fecha: fechaIso,
});

const accionAusencia = z
  .object({
    tipo: z.literal("registrar_ausencia"),
    empleado_id: z.number().int().positive(),
    tipo_ausencia: z
      .enum(["vacaciones", "incapacidad", "permiso", "licencia"])
      .optional(),
    fecha_inicio: fechaIso,
    fecha_fin: fechaIso,
    motivo: z.string().nullable().optional(),
  })
  .superRefine((accion, ctx) => {
    if (accion.fecha_inicio > accion.fecha_fin) {
      ctx.addIssue({
        code: "custom",
        message: "fecha_inicio no puede ser posterior a fecha_fin",
        path: ["fecha_inicio"],
      });
    }
  });

const accionCancelar = z.object({
  tipo: z.literal("cancelar_turno"),
  empleado_id: z.number().int().positive(),
  fecha: fechaIso,
});

export const accionAuditoriaSchema = z.discriminatedUnion("tipo", [
  accionAsignar,
  accionAusencia,
  accionCancelar,
]);

function fechasDeAccion(accion: z.infer<typeof accionAuditoriaSchema>): string[] {
  if (accion.tipo === "registrar_ausencia") {
    return [accion.fecha_inicio, accion.fecha_fin];
  }
  return [accion.fecha];
}

export const solicitudSchema = z
  .object({
    propuesta_id: z.string().min(1),
    orden_texto: z.string(),
    extraccion: z.object({
      empleado: z.string(),
      turno: turno.nullable(),
      fechas: z.array(fechaIso),
      justificacion: z.string().nullable(),
    }),
    acciones: z.array(accionAuditoriaSchema).min(1),
    contexto: z.object({
      solapes_detectados: z.array(z.unknown()),
      ausencias_en_rango: z.array(z.unknown()),
    }),
  })
  .superRefine((solicitud, ctx) => {
    const fechas = solicitud.acciones.flatMap(fechasDeAccion);
    const minimo = fechas.reduce((a, b) => (a < b ? a : b));
    const maximo = fechas.reduce((a, b) => (a > b ? a : b));
    if (diasEntre(minimo, maximo) > 92) {
      ctx.addIssue({
        code: "custom",
        message: "el rango de la propuesta no puede superar 92 días",
        path: ["acciones"],
      });
    }
  });

export const normaCitadaSchema = z.object({
  fuente: z.string().min(1),
  articulo: z.string().min(1),
  chunk_id: z.number().int().positive(),
});

export const veredictoSchema = z.object({
  propuesta_id: z.string().min(1),
  veredicto: z.enum(["aprobado", "observaciones", "rechazado"]),
  razones: z.array(z.string()),
  normas_citadas: z.array(normaCitadaSchema),
  verificaciones: z.object({
    empleado_existe: z.boolean(),
    sin_solapes: z.boolean(),
    jornada_dentro_de_limites: z.boolean(),
  }),
});

const habilidadSchema = z.object({
  id: z.literal("auditar_propuesta"),
  name: z.string().min(1),
  description: z.string().min(1),
  inputModes: z
    .array(z.string())
    .refine((modos) => modos.includes("application/json"), "falta application/json"),
  outputModes: z
    .array(z.string())
    .refine((modos) => modos.includes("application/json"), "falta application/json"),
});

export const agentCardSchema = z.object({
  name: z.literal("Relevo Auditor"),
  description: z.string().min(1),
  url: z.string().regex(/^https?:\/\/\S+$/, "la url del agente no es válida"),
  version: z.string().min(1),
  capabilities: z.object({
    streaming: z.literal(false),
  }),
  skills: z.array(habilidadSchema).min(1),
});

export const tareaAuditoriaSchema = z.object({
  status: z.object({
    state: z.literal("completed"),
  }),
  artifacts: z
    .array(
      z.object({
        parts: z
          .array(
            z.object({
              kind: z.literal("data"),
              data: veredictoSchema,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type AccionAuditoria = z.infer<typeof accionAuditoriaSchema>;
export type SolicitudAuditoria = z.infer<typeof solicitudSchema>;
export type VeredictoAuditoria = z.infer<typeof veredictoSchema>;
export type AgentCard = z.infer<typeof agentCardSchema>;
