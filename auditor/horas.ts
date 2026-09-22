/**
 * Tope de horas ordinarias por semana calendario que aplica el auditor.
 * La spec D2 fija 44 horas desde julio de 2026 y pide citar la Ley 2101
 * de 2021. El art. 161 indexado (CST, modificado por la Ley 2466 de 2025)
 * enuncia 42 horas como duración máxima final; el umbral de esta ola es 44.
 */
export const HORAS_SEMANA_MAXIMAS = 44;

/** Art. 161 CST: la jornada ordinaria se reparte en a lo sumo 6 días. */
export const DIAS_SEMANA_MAXIMOS = 6;

/**
 * Si la semana no excede el tope pero queda a menos de 4 horas
 * (más de 40 y hasta 44), el veredicto es observaciones por límite cerca.
 */
export const MARGEN_CERCA_HORAS = 4;

function minutos(hora: string): number {
  const [horas, mins] = hora.split(":");
  const h = Number(horas);
  const m = Number(mins);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error("Hora de turno inválida.");
  }
  return h * 60 + m;
}

/** Duración en horas a partir de `turnos.hora_inicio` / `hora_fin`. */
export function horasEntre(
  inicio: string,
  fin: string,
  cruzaMedianoche: boolean,
): number {
  let delta = minutos(fin) - minutos(inicio);
  if (cruzaMedianoche || delta <= 0) {
    delta += 24 * 60;
  }
  return delta / 60;
}

export function formatearHoras(horas: number): string {
  const redondeadas = Math.round(horas * 100) / 100;
  return Number.isInteger(redondeadas)
    ? String(redondeadas)
    : redondeadas.toFixed(2);
}
