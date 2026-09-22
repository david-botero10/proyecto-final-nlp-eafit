import {
  createUIMessageStreamResponse,
  simulateReadableStream,
  type UIMessageChunk,
} from "ai";
import { claveConfigurada } from "@/lib/agente/modelo";
import {
  cuerpoChatSchema,
  mensajeSimulado,
  textoUltimoUsuario,
  type CuerpoChat,
} from "@/lib/cuerpo-chat";
import { crearCliente } from "@/lib/db/cliente";
import {
  LIMITE_CARACTERES,
  LIMITE_POR_MINUTO,
  consumirCupo,
  textoCrudoUsuario,
} from "@/lib/guardrails/entrada";
import { leerHistorial } from "@/lib/memoria/conversaciones";
import { prepararTurno } from "@/lib/memoria/turno";
import type { ContenidoMensaje, Perfil } from "@/lib/memoria/tipos";
import { atributosTurno, conSpan, recortar } from "@/lib/observabilidad/spans";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MetaChat = {
  conversacionId: string | null;
  usuario: string;
};

function jsonError(mensaje: string, status: number): Response {
  return Response.json({ error: mensaje }, { status });
}

function leerMeta(json: unknown): MetaChat | Response {
  if (!json || typeof json !== "object") {
    return { conversacionId: null, usuario: "anonimo" };
  }
  const fila = json as Record<string, unknown>;
  let conversacionId: string | null = null;
  if (fila.conversacion_id != null && fila.conversacion_id !== "") {
    if (
      typeof fila.conversacion_id !== "string" ||
      !UUID.test(fila.conversacion_id)
    ) {
      return jsonError("conversacion_id no es un UUID válido.", 400);
    }
    conversacionId = fila.conversacion_id;
  }
  if (fila.usuario != null && typeof fila.usuario !== "string") {
    return jsonError("usuario no es válido.", 400);
  }
  const usuario =
    typeof fila.usuario === "string" ? fila.usuario.trim() : "anonimo";
  if (usuario.length > 80) {
    return jsonError("usuario no es válido.", 400);
  }
  return { conversacionId, usuario: usuario.length > 0 ? usuario : "anonimo" };
}

export async function GET(peticion: Request): Promise<Response> {
  const url = new URL(peticion.url);
  const conversacionId = url.searchParams.get("conversacion_id") ?? "";
  const usuario = (url.searchParams.get("usuario") ?? "").trim();
  if (!UUID.test(conversacionId)) {
    return jsonError("conversacion_id no es un UUID válido.", 400);
  }
  if (usuario.length === 0 || usuario.length > 80) {
    return jsonError("usuario no es válido.", 400);
  }
  const { sql, cerrar } = crearCliente();
  try {
    const historial = await leerHistorial(sql, conversacionId, usuario);
    return Response.json({
      conversacion_id: conversacionId,
      mensajes: historial.map((mensaje) => ({
        rol: mensaje.rol,
        parts: mensaje.contenido.parts,
      })),
    });
  } catch {
    return jsonError("No se pudo leer la conversación.", 500);
  } finally {
    await cerrar();
  }
}

export async function POST(peticion: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await peticion.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido.", 400);
  }

  const analizado = cuerpoChatSchema.safeParse(json);
  if (!analizado.success) {
    return jsonError("El cuerpo de la petición no es válido.", 400);
  }

  const meta = leerMeta(json);
  if (meta instanceof Response) {
    return meta;
  }

  const pregunta = textoUltimoUsuario(analizado.data);
  if (pregunta === null) {
    return jsonError("No hay un mensaje de usuario con texto.", 400);
  }
  if (textoCrudoUsuario(analizado.data.messages).length > LIMITE_CARACTERES) {
    return jsonError(
      `El mensaje supera los ${LIMITE_CARACTERES} caracteres.`,
      400,
    );
  }
  if (!consumirCupo(meta.usuario)) {
    return jsonError(
      `Demasiadas peticiones. El límite es ${LIMITE_POR_MINUTO} por minuto.`,
      429,
    );
  }

  const preparado = await prepararSiHaceFalta(analizado.data, pregunta, meta);
  if (!claveConfigurada()) {
    return respuestaSimulada(pregunta, meta, preparado.guardarAsistente);
  }

  const { responderConAsistente } = await import("@/lib/agente/asistente");
  return responderConAsistente(preparado.cuerpo, pregunta, {
    perfil: preparado.perfil,
    usuario: meta.usuario,
    conversacionId: meta.conversacionId,
    guardarAsistente: preparado.guardarAsistente,
  });
}

async function prepararSiHaceFalta(
  cuerpo: CuerpoChat,
  pregunta: string,
  meta: MetaChat,
): Promise<{
  cuerpo: CuerpoChat;
  perfil: Perfil | null;
  guardarAsistente: (contenido: ContenidoMensaje) => Promise<void>;
}> {
  const vacio = async () => undefined;
  if (!meta.conversacionId && meta.usuario === "anonimo") {
    return { cuerpo, perfil: null, guardarAsistente: vacio };
  }
  const cliente = crearCliente();
  try {
    const turno = await prepararTurno(cliente.sql, {
      usuario: meta.usuario,
      conversacionId: meta.conversacionId,
      mensajes: cuerpo.messages,
      textoUsuario: pregunta,
    });
    return {
      cuerpo: { messages: turno.mensajes },
      perfil: turno.perfil,
      guardarAsistente: turno.guardarAsistente,
    };
  } catch {
    return { cuerpo, perfil: null, guardarAsistente: vacio };
  } finally {
    await cliente.cerrar();
  }
}

function respuestaSimulada(
  pregunta: string,
  meta: MetaChat,
  guardarAsistente: (contenido: ContenidoMensaje) => Promise<void>,
): Promise<Response> {
  const texto = mensajeSimulado(pregunta);
  return conSpan(
    "relevo.turno",
    {
      ...atributosTurno({
        conversacionId: meta.conversacionId,
        usuario: meta.usuario,
        intencion: "sin_modelo",
        confianza: 0,
        entrada: pregunta,
      }),
      [SemanticConventions.OUTPUT_VALUE]: recortar(texto),
    },
    async (span) => {
      span.setAttribute("intencion", "sin_modelo");
      try {
        await guardarAsistente({ parts: [{ type: "text", text: texto }] });
      } catch {
        // El stream simulado sigue aunque la memoria falle.
      }
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
    },
  );
}
