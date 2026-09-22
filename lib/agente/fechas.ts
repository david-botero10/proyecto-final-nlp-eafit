/** Fecha civil de hoy en America/Bogota, YYYY-MM-DD. */
export function fechaIsoBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function diasEntre(desde: string, hasta: string): number {
  const utc = (fecha: string) =>
    Date.UTC(
      Number(fecha.slice(0, 4)),
      Number(fecha.slice(5, 7)) - 1,
      Number(fecha.slice(8, 10)),
    );
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

/** Horizonte de propuestas: 92 días hacia adelante o hacia atrás. */
export const HORIZONTE_DIAS = 92;

export function fechaIsoValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    utc.getUTCFullYear() === anio &&
    utc.getUTCMonth() === mes - 1 &&
    utc.getUTCDate() === dia
  );
}
