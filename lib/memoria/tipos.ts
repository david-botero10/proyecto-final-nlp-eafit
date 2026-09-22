export type Perfil = {
  usuario: string;
  rol: string;
  equipo: string | null;
  preferencias: Record<string, unknown> | null;
};

export type ParteResumen =
  | { type: "text"; text: string }
  | { type: "tool"; nombre: string }
  | { type: "propuesta"; propuesta_id: string };

export type ContenidoMensaje = {
  parts: ParteResumen[];
};

export type MensajeGuardado = {
  rol: "user" | "assistant";
  contenido: ContenidoMensaje;
};

export const PERFILES_SEMILLA = [
  {
    usuario: "coordinadora_enfermeria",
    rol: "coordinador",
    equipo: "enfermeria",
  },
  {
    usuario: "jefe_vigilancia",
    rol: "coordinador",
    equipo: "vigilancia",
  },
  {
    usuario: "gerencia",
    rol: "gerente",
    equipo: "todos",
  },
] as const;
