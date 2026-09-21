import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import type { CuerpoChat } from "@/lib/cuerpo-chat";
import {
  buscarNormaEntrada,
  consultarAusenciasEntrada,
  consultarTurnosEntrada,
  listarEmpleadosEntrada,
} from "@/mcp/esquemas";
import { llamarHerramienta } from "./mcp";
import { crearModelo } from "./modelo";
import { fechaBogota, systemRelevo } from "./prompt";
import {
  clasificarIntencion,
  type Clasificacion,
} from "./router";

export type MensajeRelevo = UIMessage<
  unknown,
  { intencion: Clasificacion }
>;

const FALLBACK: Clasificacion = {
  intencion: "charla",
  confianza: 0,
  razon: "No se pudo clasificar el mensaje.",
};

function herramientas() {
  return {
    listar_empleados: tool({
      description:
        "Lista empleados sintéticos (id, nombre, rol, equipo), ordenados por nombre. Filtros opcionales: equipo y activo.",
      inputSchema: listarEmpleadosEntrada,
      execute: async (argumentos) =>
        llamarHerramienta("listar_empleados", argumentos),
    }),
    consultar_turnos: tool({
      description:
        "Asignaciones en un rango de fechas (máximo 92 días), con nombre, turno y estado. empleado puede ser id o nombre.",
      inputSchema: consultarTurnosEntrada,
      execute: async (argumentos) =>
        llamarHerramienta("consultar_turnos", argumentos),
    }),
    consultar_ausencias: tool({
      description:
        "Ausencias que se solapan con un rango de fechas (máximo 92 días). tipo: vacaciones, incapacidad, permiso o licencia.",
      inputSchema: consultarAusenciasEntrada,
      execute: async (argumentos) =>
        llamarHerramienta("consultar_ausencias", argumentos),
    }),
    buscar_norma: tool({
      description:
        "Busca en la norma laboral colombiana (búsqueda híbrida). Úsala para jornada, recargos, descansos y dominicales. Cita los resultados en orden como [1], [2], …",
      inputSchema: buscarNormaEntrada,
      execute: async (argumentos) =>
        llamarHerramienta("buscar_norma", argumentos),
    }),
  };
}

function mensajesParaModelo(cuerpo: CuerpoChat): UIMessage[] {
  return cuerpo.messages.map((mensaje, indice) => ({
    id: mensaje.id ?? `m-${indice}`,
    role: mensaje.role,
    parts: mensaje.parts
      .filter((parte) => {
        const tipo = parte.type;
        return (
          tipo === "text" ||
          tipo.startsWith("tool-") ||
          tipo === "dynamic-tool"
        );
      })
      .map((parte) => {
        if (parte.type === "text") {
          return { type: "text" as const, text: parte.text ?? "" };
        }
        return parte;
      }),
  })) as UIMessage[];
}

/** Stream del asistente con router, tools MCP y el data part de intención. */
export async function responderConAsistente(
  cuerpo: CuerpoChat,
  pregunta: string,
): Promise<Response> {
  const modelo = crearModelo();
  if (!modelo) {
    throw new Error("Sin XAI_API_KEY");
  }

  let clasificacion = FALLBACK;
  try {
    clasificacion = await clasificarIntencion(pregunta);
  } catch {
    clasificacion = FALLBACK;
  }

  const fecha = fechaBogota();
  const system = systemRelevo(fecha, clasificacion);
  const stream = createUIMessageStream<MensajeRelevo>({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-intencion",
        id: "intencion",
        data: clasificacion,
      });
      const mensajes = await convertToModelMessages(
        mensajesParaModelo(cuerpo),
      );
      const resultado = streamText({
        model: modelo,
        system,
        messages: mensajes,
        tools: herramientas(),
        stopWhen: stepCountIs(6),
      });
      writer.merge(resultado.toUIMessageStream());
    },
    onError: () => "No se pudo completar la respuesta.",
  });

  return createUIMessageStreamResponse({ stream });
}
