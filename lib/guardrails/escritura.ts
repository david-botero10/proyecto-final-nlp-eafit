import { nombresHerramientas } from "@/lib/agente/asistente";

/** Tools que escriben nómina. crear_propuesta no está: solo deja una tarjeta pendiente. */
const ESCRITURA_NOMINA = ["ejecutar_propuesta"];

export function herramientasProhibidas(nombres: string[]): string[] {
  return nombres.filter((nombre) => ESCRITURA_NOMINA.includes(nombre));
}

/** Lanza si el modelo puede llamar una tool que escribe nómina. */
export function afirmarSinEscrituraDirecta(
  nombres: string[] = nombresHerramientas(),
): void {
  const prohibidas = herramientasProhibidas(nombres);
  if (prohibidas.length > 0) {
    throw new Error(
      `El modelo no puede escribir nómina. Tools prohibidas: ${prohibidas.join(", ")}.`,
    );
  }
}
