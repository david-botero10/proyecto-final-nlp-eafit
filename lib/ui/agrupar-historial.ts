export type ConversacionResumen = {
  id: string;
  titulo: string;
  ultima_actividad: string;
};

export type GrupoHistorial = {
  etiqueta: "Hoy" | "Ayer" | "Últimos 7 días" | "Anteriores";
  conversaciones: ConversacionResumen[];
};

const ORDEN = ["Hoy", "Ayer", "Últimos 7 días", "Anteriores"] as const;
const DIA = 86_400_000;

function inicioDelDia(fecha: Date): number {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
  ).getTime();
}

/** Agrupa por día local, respetando el orden recibido dentro de cada grupo. */
export function agruparHistorial(
  conversaciones: ConversacionResumen[],
  ahora: Date = new Date(),
): GrupoHistorial[] {
  const hoy = inicioDelDia(ahora);
  const cubetas = new Map<GrupoHistorial["etiqueta"], ConversacionResumen[]>();
  for (const conversacion of conversaciones) {
    const dia = inicioDelDia(new Date(conversacion.ultima_actividad));
    const diferencia = Math.round((hoy - dia) / DIA);
    const etiqueta =
      diferencia <= 0
        ? "Hoy"
        : diferencia === 1
          ? "Ayer"
          : diferencia <= 7
            ? "Últimos 7 días"
            : "Anteriores";
    cubetas.set(etiqueta, [...(cubetas.get(etiqueta) ?? []), conversacion]);
  }
  return ORDEN.flatMap((etiqueta) => {
    const lista = cubetas.get(etiqueta);
    return lista && lista.length > 0 ? [{ etiqueta, conversaciones: lista }] : [];
  });
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarHistorial(
  conversaciones: ConversacionResumen[],
  busqueda: string,
): ConversacionResumen[] {
  const termino = normalizar(busqueda);
  if (termino.length === 0) {
    return conversaciones;
  }
  return conversaciones.filter((conversacion) =>
    normalizar(conversacion.titulo).includes(termino),
  );
}
