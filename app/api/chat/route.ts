import {
  cuerpoChatSchema,
  mensajeSimulado,
  textoUltimoUsuario,
} from "@/lib/cuerpo-chat";
import {
  createUIMessageStreamResponse,
  simulateReadableStream,
  type UIMessageChunk,
} from "ai";

export async function POST(peticion: Request) {
  let json: unknown;
  try {
    json = await peticion.json();
  } catch {
    return Response.json(
      { error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const analizado = cuerpoChatSchema.safeParse(json);
  if (!analizado.success) {
    return Response.json(
      { error: "El cuerpo de la petición no es válido." },
      { status: 400 },
    );
  }

  const pregunta = textoUltimoUsuario(analizado.data);
  if (pregunta === null) {
    return Response.json(
      { error: "No hay un mensaje de usuario con texto." },
      { status: 400 },
    );
  }

  const texto = mensajeSimulado(pregunta);
  const chunks: UIMessageChunk[] = [
    { type: "start" },
    { type: "text-start", id: "texto-1" },
    { type: "text-delta", id: "texto-1", delta: texto },
    { type: "text-end", id: "texto-1" },
    { type: "finish" },
  ];

  return createUIMessageStreamResponse({
    stream: simulateReadableStream({
      chunks,
      initialDelayInMs: 0,
      chunkDelayInMs: 0,
    }),
  });
}
