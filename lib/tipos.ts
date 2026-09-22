/** Contratos de dominio de docs/ARQUITECTURA.md §4, extendidos en D1. */

export const TURNO = {
  MANANA: "M",
  TARDE: "T",
  NOCHE: "N",
} as const;

export type Turno = (typeof TURNO)[keyof typeof TURNO];

export const TIPO_ACCION = {
  ASIGNAR_TURNO: "asignar_turno",
  REGISTRAR_AUSENCIA: "registrar_ausencia",
  CANCELAR_TURNO: "cancelar_turno",
} as const;

export type TipoAccion = (typeof TIPO_ACCION)[keyof typeof TIPO_ACCION];

export const TIPO_AUSENCIA = {
  VACACIONES: "vacaciones",
  INCAPACIDAD: "incapacidad",
  PERMISO: "permiso",
  LICENCIA: "licencia",
} as const;

export type TipoAusencia = (typeof TIPO_AUSENCIA)[keyof typeof TIPO_AUSENCIA];

export const ACCION_EXTRACCION = {
  ASIGNAR: "asignar",
  AUSENCIA: "ausencia",
  QUITAR: "quitar",
} as const;

export type AccionExtraccion =
  (typeof ACCION_EXTRACCION)[keyof typeof ACCION_EXTRACCION];

export const PROVEEDOR_EXTRACCION = {
  XAI: "xai",
  LORA: "lora",
} as const;

export type ProveedorExtraccion =
  (typeof PROVEEDOR_EXTRACCION)[keyof typeof PROVEEDOR_EXTRACCION];

export const VEREDICTO = {
  APROBADO: "aprobado",
  OBSERVACIONES: "observaciones",
  RECHAZADO: "rechazado",
} as const;

export type Veredicto = (typeof VEREDICTO)[keyof typeof VEREDICTO];

export const ESTADO_PROPUESTA = {
  PENDIENTE: "pendiente",
  APROBADA: "aprobada",
  CORREGIDA: "corregida",
  RECHAZADA: "rechazada",
  EXPIRADA: "expirada",
} as const;

export type EstadoPropuesta =
  (typeof ESTADO_PROPUESTA)[keyof typeof ESTADO_PROPUESTA];

export const DECISION = {
  APROBAR: "aprobar",
  CORREGIR: "corregir",
  RECHAZAR: "rechazar",
} as const;

export type Decision = (typeof DECISION)[keyof typeof DECISION];

/** Usuario que queda en la propuesta cuando la orden no trae uno. */
export const USUARIO_TARJETA = "coordinador";

export interface Extraccion {
  empleado: string;
  turno: Turno | null;
  fechas: string[];
  justificacion: string | null;
  accion: AccionExtraccion;
  proveedor: ProveedorExtraccion;
}

export interface AccionAsignar {
  tipo: typeof TIPO_ACCION.ASIGNAR_TURNO;
  empleado_id: number;
  turno: Turno;
  fecha: string;
}

/**
 * `tipo` discrimina la acción, igual que en asignar_turno.
 * La categoría de la ausencia va en `tipo_ausencia`.
 */
export interface AccionAusencia {
  tipo: typeof TIPO_ACCION.REGISTRAR_AUSENCIA;
  empleado_id: number;
  tipo_ausencia: TipoAusencia;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
}

export interface AccionCancelar {
  tipo: typeof TIPO_ACCION.CANCELAR_TURNO;
  empleado_id: number;
  fecha: string;
}

export type Accion = AccionAsignar | AccionAusencia | AccionCancelar;

export interface SolapeDetectado {
  empleado_id: number;
  empleado: string;
  fecha: string;
  turno: string;
  estado: string;
}

export interface AusenciaEnRango {
  empleado_id: number;
  empleado: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

export interface ContextoPropuesta {
  solapes_detectados: SolapeDetectado[];
  ausencias_en_rango: AusenciaEnRango[];
}

export interface NombreEmpleado {
  id: number;
  nombre: string;
}

export interface Propuesta {
  propuesta_id: string;
  estado: EstadoPropuesta;
  usuario: string;
  orden_texto: string;
  extraccion: Extraccion;
  acciones: Accion[];
  contexto: ContextoPropuesta;
  veredicto_auditor: VeredictoAuditor | null;
  nombres: NombreEmpleado[];
}

export interface ResumenEjecucion {
  propuesta_id: string;
  decision: Decision;
  estado: EstadoPropuesta;
  filas: {
    asignaciones: number;
    ausencias: number;
    cancelaciones: number;
  };
}

export interface NormaCitada {
  fuente: string;
  articulo: string;
  chunk_id: number;
}

export interface VerificacionesAuditor {
  empleado_existe: boolean;
  sin_solapes: boolean;
  jornada_dentro_de_limites: boolean;
}

export interface VeredictoAuditor {
  propuesta_id: string;
  veredicto: Veredicto;
  razones: string[];
  normas_citadas: NormaCitada[];
  verificaciones: VerificacionesAuditor;
}
