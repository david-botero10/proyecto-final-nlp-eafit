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
  crearPropuestaEntrada,
  listarEmpleadosEntrada,
} from "@/mcp/esquemas";
import type { Propuesta } from "@/lib/tipos";
import { procesarOrdenEscritura, type ResultadoOrden } from "./flujo-escritura";
import { llamarHerramienta } from "./mcp";
import { crearModelo } from "./modelo";
import { fechaBogota, systemRelevo } from "./prompt";
import {
  clasificarIntencion,
  type Clasificacion,
} from "./router";

export type MensajeRelevo = UIMessage<
  unknown,
  { intencion: Clasificacion; propuesta: Propuesta }
>;

export type DepsAsistente = {
  clasificar?: (texto: string) => Promise<Clasificacion>;
  procesarOrden?: (orden: string) => Promise<ResultadoOrden>;
};

const FALLBACK: Clasificacion = {
  intencion: "charla",
  confianza: 0,
  razon: "No se pudo clasificar el mensaje.",
};

function esPropuesta(valor: unknown): valor is Propuesta {
  if (!valor || typeof valor !== "object") {
    return false;
  }
  const fila = valor as Partial<Propuesta>;
  return (
    typeof fila.propuesta_id === "string" &&
    typeof fila.orden_texto === "string" &&
    Array.isArray(fila.acciones) &&
    fila.contexto !== undefined &&
    fila.extraccion !== undefined
  );
}

function herramientas(alCrear?: (propuesta: Propuesta) => void) {
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
    crear_propuesta: tool({
      description:
        "Deja una propuesta pendiente de aprobación. No escribe turnos ni ausencias. Úsala solo después de extraer la orden y consultar empleados, turnos y ausencias.",
      inputSchema: crearPropuestaEntrada,
      execute: async (argumentos) => {
        const resultado = await llamarHerramienta("crear_propuesta", argumentos);
        if (alCrear && esPropuesta(resultado)) {
          alCrear(resultado);
        }
        return resultado;
      },
    }),
  };
}

/** Nombres expuestos al modelo. ejecutar_propuesta no entra aquí. */
export function nombresHerramientas(): string[] {
  return Object.keys(herramientas());
}

function streamOrden(
  clasificacion: Clasificacion,
  pregunta: string,
  procesar: (orden: string) => Promise<ResultadoOrden>,
): Response {
  const stream = createUIMessageStream<MensajeRelevo>({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-intencion",
        id: "intencion",
        data: clasificacion,
      });
      const resultado = await procesar(pregunta);
      if (resultado.ok) {
        writer.write({
          type: "data-propuesta",
          id: resultado.propuesta.propuesta_id,
          data: resultado.propuesta,
        });
      }
      const id = "texto-orden";
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: resultado.texto });
      writer.write({ type: "text-end", id });
    },
    onError: () => "No se pudo completar la respuesta.",
  });
  return createUIMessageStreamResponse({ stream });
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
  deps?: DepsAsistente,
): Promise<Response> {
  let clasificacion = FALLBACK;
  try {
    clasificacion = deps?.clasificar
      ? await deps.clasificar(pregunta)
      : await clasificarIntencion(pregunta);
  } catch {
    clasificacion = FALLBACK;
  }

  if (clasificacion.intencion === "orden_escritura") {
    return streamOrden(
      clasificacion,
      pregunta,
      deps?.procesarOrden ?? ((orden) => procesarOrdenEscritura(orden)),
    );
  }

  const modelo = crearModelo();
  if (!modelo) {
    throw new Error("Sin XAI_API_KEY");
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
        tools: herramientas((propuesta) => {
          writer.write({
            type: "data-propuesta",
            id: propuesta.propuesta_id,
            data: propuesta,
          });
        }),
        stopWhen: stepCountIs(6),
      });
      writer.merge(resultado.toUIMessageStream());
    },
    onError: () => "No se pudo completar la respuesta.",
  });

  return createUIMessageStreamResponse({ stream });
}
