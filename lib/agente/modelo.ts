import { createXai } from "@ai-sdk/xai";

/** Modelo de chat si no hay RELEVO_MODELO. */
export const MODELO_POR_DEFECTO = "grok-4.6";

/** La clave solo se lee de entorno; no se registra ni se devuelve. */
export function claveConfigurada(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export function crearModelo() {
  const clave = process.env.XAI_API_KEY?.trim();
  if (!clave) {
    return null;
  }
  const nombre = process.env.RELEVO_MODELO?.trim() || MODELO_POR_DEFECTO;
  return createXai({ apiKey: clave })(nombre);
}
