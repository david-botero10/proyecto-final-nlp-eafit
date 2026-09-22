/**
 * Juez de fidelidad. Sin XAI_API_KEY no llama a la red y devuelve null.
 * La clave se lee del entorno o de .env y no se imprime.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL_XAI = "https://api.x.ai/v1/chat/completions";

export type ChunkCitado = {
  ref: string | null;
  fuente: string;
  fragmento: string;
};

export type JuicioCita = {
  respuesta: string;
  afirmaciones: { texto: string; soportada: boolean }[];
  fidelidad: number;
};

export function fidelidadDe(soportadas: readonly boolean[]): number {
  if (soportadas.length === 0) {
    throw new Error("El juez no devolvió afirmaciones.");
  }
  const aciertos = soportadas.filter((valor) => valor).length;
  return aciertos / soportadas.length;
}

export function claveXai(): string | null {
  const directa = process.env.XAI_API_KEY?.trim();
  if (directa) {
    return directa;
  }
  const ruta = path.join(RAIZ, ".env");
  let texto: string;
  try {
    texto = readFileSync(ruta, "utf8");
  } catch {
    return null;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#") || !limpia.includes("=")) {
      continue;
    }
    const corte = limpia.indexOf("=");
    const clave = limpia.slice(0, corte).trim();
    if (clave !== "XAI_API_KEY") {
      continue;
    }
    const valor = limpia.slice(corte + 1).trim().replace(/^["']|["']$/g, "");
    return valor || null;
  }
  return null;
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

async function completar(clave: string, system: string, prompt: string): Promise<string> {
  const modelo = process.env.XAI_MODEL?.trim() || "grok-4.6";
  const respuesta = await fetch(URL_XAI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify({
      model: modelo,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!respuesta.ok) {
    throw new Error(`xAI respondió HTTP ${respuesta.status}`);
  }
  const cuerpo = (await respuesta.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = cuerpo.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("xAI no devolvió texto.");
  }
  return content;
}

function bloqueChunks(chunks: readonly ChunkCitado[]): string {
  return chunks
    .map((chunk, indice) => {
      const ref = chunk.ref ?? "s.f.";
      return `[${indice + 1}] ${ref} (${chunk.fuente})\n${chunk.fragmento}`;
    })
    .join("\n\n");
}

function juicioValido(valor: unknown): { texto: string; soportada: boolean }[] | null {
  if (!valor || typeof valor !== "object" || !("afirmaciones" in valor)) {
    return null;
  }
  const lista = (valor as { afirmaciones: unknown }).afirmaciones;
  if (!Array.isArray(lista) || lista.length === 0) {
    return null;
  }
  const afirmaciones: { texto: string; soportada: boolean }[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const texto = (item as { texto?: unknown }).texto;
    const soportada = (item as { soportada?: unknown }).soportada;
    if (typeof texto !== "string" || texto.trim().length === 0) {
      return null;
    }
    if (typeof soportada !== "boolean") {
      return null;
    }
    afirmaciones.push({ texto: texto.trim(), soportada });
  }
  return afirmaciones;
}

/**
 * Genera una respuesta citada y pide al juez si cada afirmación
 * está soportada por los chunks. Null si no hay clave.
 */
export async function juzgarCitas(
  pregunta: string,
  chunks: readonly ChunkCitado[],
): Promise<JuicioCita | null> {
  const clave = claveXai();
  if (!clave) {
    return null;
  }
  if (chunks.length === 0) {
    return {
      respuesta: "",
      afirmaciones: [],
      fidelidad: 0,
    };
  }
  const contexto = bloqueChunks(chunks);
  const respuesta = await completar(
    clave,
    [
      "Respondes en español, en un párrafo corto, usando solo los fragmentos.",
      "Cada frase normativa cita el artículo entre paréntesis, por ejemplo (art. 168).",
      "Si el fragmento no alcanza, dilo y no inventes el número.",
    ].join(" "),
    `Pregunta: ${pregunta}\n\nFragmentos:\n${contexto}`,
  );
  const crudo = await completar(
    clave,
    [
      "Eres el juez de fidelidad de citas de Relevo.",
      "Parte la respuesta en afirmaciones normativas.",
      "soportada es true solo si el fragmento citado dice eso.",
      'Responde solo JSON: {"afirmaciones":[{"texto":"...","soportada":true}]}.',
    ].join(" "),
    `Pregunta: ${pregunta}\n\nFragmentos:\n${contexto}\n\nRespuesta:\n${respuesta}`,
  );
  const afirmaciones = juicioValido(extraerJson(crudo));
  if (!afirmaciones) {
    throw new Error("El juez no devolvió JSON utilizable.");
  }
  return {
    respuesta,
    afirmaciones,
    fidelidad: fidelidadDe(afirmaciones.map((item) => item.soportada)),
  };
}
