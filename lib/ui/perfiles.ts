/** Perfiles de la demo. Los ids son los mismos que usa el backend (tabla perfiles). */
export const USUARIOS = [
  {
    id: "coordinadora_enfermeria",
    etiqueta: "Coordinadora de enfermería",
    alcance: "Coordinadora · enfermería",
    iniciales: "CE",
  },
  {
    id: "jefe_vigilancia",
    etiqueta: "Jefe de vigilancia",
    alcance: "Coordinador · vigilancia",
    iniciales: "JV",
  },
  {
    id: "gerencia",
    etiqueta: "Gerencia",
    alcance: "Gerente · todos los equipos",
    iniciales: "GE",
  },
] as const;

export type PerfilUi = (typeof USUARIOS)[number];

export const CLAVE_USUARIO = "relevo.usuario";
export const CLAVE_CONVERSACION = "relevo.conversacion_id";

export function perfilPorId(id: string): PerfilUi {
  return USUARIOS.find((perfil) => perfil.id === id) ?? USUARIOS[0];
}

export function esUsuarioConocido(id: string): boolean {
  return USUARIOS.some((perfil) => perfil.id === id);
}

export function saludoDeLaHora(fecha: Date): string {
  const hora = fecha.getHours();
  if (hora >= 5 && hora < 12) {
    return "Buenos días";
  }
  if (hora >= 12 && hora < 19) {
    return "Buenas tardes";
  }
  return "Buenas noches";
}

export type Sugerencia = {
  categoria: "Norma" | "Turnos" | "Orden" | "Ausencias";
  titulo: string;
  pregunta: string;
};

/** Las cuatro interacciones de la demo, en este orden. */
export const SUGERENCIAS: readonly Sugerencia[] = [
  {
    categoria: "Norma",
    titulo: "Recargo nocturno",
    pregunta: "¿Cuánto me pagan de recargo si trabajo de noche?",
  },
  {
    categoria: "Turnos",
    titulo: "Turnos de mi equipo",
    pregunta:
      "¿Quiénes de mi equipo están de turno de noche el sábado 26 de septiembre?",
  },
  {
    categoria: "Orden",
    titulo: "Cambiar un turno",
    pregunta:
      "Ponle el turno de la mañana a Elizabeth María López el próximo domingo",
  },
  {
    categoria: "Ausencias",
    titulo: "Ausencias de la semana",
    pregunta: "¿Qué ausencias hay registradas esta semana?",
  },
];
