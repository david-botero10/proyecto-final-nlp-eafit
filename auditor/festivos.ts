/**
 * Festivos nacionales de Colombia en 2026.
 * Ley 51 de 1983 (Ley Emiliani): los trasladables se celebran el lunes
 * siguiente cuando no caen en lunes. 2026-10-12 cae en lunes y no se mueve.
 * No incluye la Virgen del Carmen: no está en el calendario de 18 festivos
 * de esa ley (timeanddate, 2026).
 */
export const FESTIVOS_2026: Readonly<Record<string, string>> = {
  "2026-01-01": "Año Nuevo",
  "2026-01-12": "Reyes Magos",
  "2026-03-23": "San José",
  "2026-04-02": "Jueves Santo",
  "2026-04-03": "Viernes Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-18": "Ascensión del Señor",
  "2026-06-08": "Corpus Christi",
  "2026-06-15": "Sagrado Corazón",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-20": "Independencia",
  "2026-08-07": "Batalla de Boyacá",
  "2026-08-17": "Asunción de la Virgen",
  "2026-10-12": "Día de la Raza",
  "2026-11-02": "Todos los Santos",
  "2026-11-16": "Independencia de Cartagena",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad",
};

export function nombreFestivo(iso: string): string | null {
  return FESTIVOS_2026[iso] ?? null;
}

export function esFestivo(iso: string): boolean {
  return nombreFestivo(iso) !== null;
}
