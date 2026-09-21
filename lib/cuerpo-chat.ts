import { z } from "zod";

const parteSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const mensajeSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(parteSchema).min(1),
});

export const cuerpoChatSchema = z.object({
  messages: z.array(mensajeSchema).min(1),
});

export type CuerpoChat = z.infer<typeof cuerpoChatSchema>;

export function textoUltimoUsuario(cuerpo: CuerpoChat): string | null {
  const usuario = [...cuerpo.messages]
    .reverse()
    .find((mensaje) => mensaje.role === "user");
  if (!usuario) {
    return null;
  }
  const texto = usuario.parts
    .filter((parte) => parte.type === "text")
    .map((parte) => parte.text ?? "")
    .join("")
    .trim();
  return texto.length > 0 ? texto : null;
}

export function mensajeSimulado(pregunta: string): string {
  return `Soy Relevo. Aún no tengo modelo conectado (llega en la semana 3), pero mi interfaz ya funciona. Para usar Grok, configura XAI_API_KEY. Me preguntaste: "${pregunta}"`;
}
