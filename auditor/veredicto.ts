import type { NormaCitada, Veredicto, VeredictoAuditor } from "../lib/tipos";

export type Hallazgos = {
  empleado_existe: boolean;
  sin_solapes: boolean;
  jornada_dentro_de_limites: boolean;
  razones: string[];
  normas_citadas: NormaCitada[];
  hayObservacion: boolean;
};

const FRASE_APROBADA =
  "La propuesta cumple las verificaciones: empleado activo, sin solapes y dentro de la jornada.";

/**
 * El veredicto sale de las reglas, no del modelo.
 * Rechazo solo si el empleado no existe o hay solape duro.
 * Dominical, festivo, nocturno y el límite semanal quedan en observaciones.
 */
export function construirVeredicto(
  propuestaId: string,
  hallazgos: Hallazgos,
): VeredictoAuditor {
  let veredicto: Veredicto;
  if (!hallazgos.empleado_existe || !hallazgos.sin_solapes) {
    veredicto = "rechazado";
  } else if (
    hallazgos.hayObservacion ||
    !hallazgos.jornada_dentro_de_limites
  ) {
    veredicto = "observaciones";
  } else {
    veredicto = "aprobado";
  }

  const razones =
    veredicto === "aprobado"
      ? [FRASE_APROBADA]
      : hallazgos.razones.length > 0
        ? hallazgos.razones
        : ["La propuesta no pasa las verificaciones."];

  return {
    propuesta_id: propuestaId,
    veredicto,
    razones,
    normas_citadas: veredicto === "aprobado" ? [] : hallazgos.normas_citadas,
    verificaciones: {
      empleado_existe: hallazgos.empleado_existe,
      sin_solapes: hallazgos.sin_solapes,
      jornada_dentro_de_limites: hallazgos.jornada_dentro_de_limites,
    },
  };
}
