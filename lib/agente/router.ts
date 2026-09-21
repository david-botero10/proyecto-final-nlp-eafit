import { generateObject } from "ai";
import { z } from "zod";
import { crearModelo } from "./modelo";

export const INTENCIONES = [
  "charla",
  "consulta_datos",
  "consulta_norma",
  "orden_escritura",
] as const;

export const clasificacionSchema = z.object({
  intencion: z.enum(INTENCIONES),
  confianza: z.number().min(0).max(1),
  razon: z.string().min(1),
});

export type Clasificacion = z.infer<typeof clasificacionSchema>;

export const SYSTEM_ROUTER = [
  "Clasifica el último mensaje de un coordinador de turnos en Colombia.",
  "intencion:",
  "- charla: saludo, agradecimiento o conversación sin un pedido concreto.",
  "- consulta_datos: pregunta por empleados, turnos o ausencias de la nómina.",
  "- consulta_norma: pregunta por la norma laboral (jornada, recargos, descansos, dominical).",
  "- orden_escritura: pide asignar, cambiar o quitar turnos o ausencias.",
  "confianza es un número entre 0 y 1. razon es una frase corta en español.",
].join("\n");

export type GenerarClasificacion = (entrada: {
  system: string;
  prompt: string;
}) => Promise<unknown>;

export type OpcionesRouter = {
  generar?: GenerarClasificacion;
};

/** Clasifica el mensaje. `generar` sustituye al modelo en tests (sin red). */
export async function clasificarIntencion(
  texto: string,
  opciones?: OpcionesRouter,
): Promise<Clasificacion> {
  const crudo = opciones?.generar
    ? await opciones.generar({ system: SYSTEM_ROUTER, prompt: texto })
    : await generarConModelo(texto);
  return clasificacionSchema.parse(crudo);
}

async function generarConModelo(texto: string): Promise<unknown> {
  const modelo = crearModelo();
  if (!modelo) {
    throw new Error("Sin XAI_API_KEY");
  }
  const { object } = await generateObject({
    model: modelo,
    schema: clasificacionSchema,
    system: SYSTEM_ROUTER,
    prompt: texto,
  });
  return object;
}
