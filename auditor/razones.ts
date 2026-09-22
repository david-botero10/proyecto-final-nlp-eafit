import { generateText } from "ai";
import { createXai } from "@ai-sdk/xai";
import type { Veredicto } from "../lib/tipos";

const MODELO_POR_DEFECTO = "grok-4.6";

function debeRedactar(): boolean {
  if (process.env.VITEST) {
    return false;
  }
  if (process.env.AUDITOR_RAZONES_LLM === "0") {
    return false;
  }
  return Boolean(process.env.XAI_API_KEY?.trim());
}

function extraerJson(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) {
    return null;
  }
  return JSON.parse(limpio.slice(inicio, fin + 1)) as unknown;
}

function razonesValidas(valor: unknown): string[] | null {
  if (!valor || typeof valor !== "object" || !("razones" in valor)) {
    return null;
  }
  const lista = (valor as { razones: unknown }).razones;
  if (!Array.isArray(lista) || lista.length === 0) {
    return null;
  }
  if (!lista.every((razon) => typeof razon === "string" && razon.trim())) {
    return null;
  }
  return lista.map((razon) => razon.trim());
}

/**
 * Redacta las razones ya decididas. No cambia el veredicto.
 * Sin clave, en tests o si el modelo falla, se conservan las plantillas.
 */
export async function redactarRazones(
  razones: string[],
  veredicto: Veredicto,
): Promise<string[]> {
  if (!debeRedactar() || razones.length === 0) {
    return razones;
  }
  const clave = process.env.XAI_API_KEY?.trim();
  if (!clave) {
    return razones;
  }
  const nombre = process.env.RELEVO_MODELO?.trim() || MODELO_POR_DEFECTO;
  const lista = razones.map((razon) => `- ${razon}`).join("\n");
  try {
    const { text } = await generateText({
      model: createXai({ apiKey: clave })(nombre),
      system: [
        "Redactas en español claro las razones de una auditoría de turnos ya decidida.",
        `El veredicto es «${veredicto}» y no puedes cambiarlo ni suavizar un rechazo.`,
        "No agregues hechos que no estén en la lista.",
        'Responde solo JSON: {"razones":["..."]}.',
      ].join(" "),
      prompt: lista,
      abortSignal: AbortSignal.timeout(4000),
    });
    const validas = razonesValidas(extraerJson(text));
    return validas ?? razones;
  } catch {
    return razones;
  }
}
