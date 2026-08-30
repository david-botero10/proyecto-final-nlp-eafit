/** Contratos de dominio copiados de docs/ARQUITECTURA.md §4. */

export const TURNO = {
  MANANA: "M",
  TARDE: "T",
  NOCHE: "N",
} as const;

export type Turno = (typeof TURNO)[keyof typeof TURNO];

export const TIPO_ACCION = {
  ASIGNAR_TURNO: "asignar_turno",
} as const;

export type TipoAccion = (typeof TIPO_ACCION)[keyof typeof TIPO_ACCION];

export const VEREDICTO = {
  APROBADO: "aprobado",
  OBSERVACIONES: "observaciones",
  RECHAZADO: "rechazado",
} as const;

export type Veredicto = (typeof VEREDICTO)[keyof typeof VEREDICTO];

export interface Extraccion {
  empleado: string;
  turno: Turno;
  fechas: string[];
  justificacion: string | null;
}

export interface Accion {
  tipo: TipoAccion;
  empleado_id: number;
  turno: Turno;
  fecha: string;
}

export interface ContextoPropuesta {
  solapes_detectados: unknown[];
  ausencias_en_rango: unknown[];
}

export interface Propuesta {
  propuesta_id: string;
  orden_texto: string;
  extraccion: Extraccion;
  acciones: Accion[];
  contexto: ContextoPropuesta;
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
