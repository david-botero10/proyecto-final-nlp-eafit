/** Fechas ISO (YYYY-MM-DD) en UTC. Evita el corrimiento de zona de Colombia. */

function partes(iso: string): [number, number, number] {
  return [
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)),
    Number(iso.slice(8, 10)),
  ];
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = partes(iso);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aIso(fecha);
}

/** Lunes de la semana calendario (lunes a domingo) que contiene `iso`. */
export function lunesDe(iso: string): string {
  const [y, m, d] = partes(iso);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  const dia = fecha.getUTCDay();
  const delta = dia === 0 ? -6 : 1 - dia;
  fecha.setUTCDate(fecha.getUTCDate() + delta);
  return aIso(fecha);
}

export function esDomingo(iso: string): boolean {
  const [y, m, d] = partes(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

/** Días inclusive. El llamador ya limita el rango a 92 días. */
export function cadaDia(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  let actual = desde;
  while (actual <= hasta && dias.length <= 93) {
    dias.push(actual);
    actual = sumarDias(actual, 1);
  }
  return dias;
}
