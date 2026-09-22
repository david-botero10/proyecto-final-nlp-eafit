import { context } from "@opentelemetry/api";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
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
import { anexarNotaCitas, evaluarCitas, NOTA_CITAS } from "@/lib/guardrails/citas";
import type { ContenidoMensaje, Perfil } from "@/lib/memoria/tipos";
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
import { clasificarIntencion, type Clasificacion } from "./router";
import {
  abrirSpan,
  atributosLlm,
  atributosTurno,
  cerrarSpan,
  conSpan,
  recortar,
} from "@/lib/observabilidad/spans";

export type MensajeRelevo = UIMessage<
  unknown,
  { intencion: Clasificacion; propuesta: Propuesta }
>;

export type DepsAsistente = {
  clasificar?: (texto: string) => Promise<Clasificacion>;
  procesarOrden?: (orden: string) => Promise<ResultadoOrden>;
  /** Sustituye al modelo en tests. No se usa en producción. */
  completarTexto?: (texto: string) => Promise<string>;
  perfil?: Perfil | null;
  usuario?: string;
  conversacionId?: string | null;
  guardarAsistente?: (contenido: ContenidoMensaje) => Promise<void>;
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

function herramientas(
  perfil: Perfil | null,
  alCrear?: (propuesta: Propuesta) => void,
  alTool?: (nombre: string) => void,
) {
  const ejecutar =
    (nombre: string) => async (argumentos: Record<string, unknown>) => {
      alTool?.(nombre);
      return llamarHerramienta(nombre, argumentos, { perfil });
    };
  return {
    listar_empleados: tool({
      description:
        "Lista empleados sintéticos (id, nombre, rol, equipo), ordenados por nombre. Filtros opcionales: equipo y activo.",
      inputSchema: listarEmpleadosEntrada,
      execute: async (argumentos) => ejecutar("listar_empleados")(argumentos),
    }),
    consultar_turnos: tool({
      description:
        "Asignaciones en un rango de fechas (máximo 92 días), con nombre, turno y estado. empleado puede ser id o nombre.",
      inputSchema: consultarTurnosEntrada,
      execute: async (argumentos) => ejecutar("consultar_turnos")(argumentos),
    }),
    consultar_ausencias: tool({
      description:
        "Ausencias que se solapan con un rango de fechas (máximo 92 días). tipo: vacaciones, incapacidad, permiso o licencia.",
      inputSchema: consultarAusenciasEntrada,
      execute: async (argumentos) => ejecutar("consultar_ausencias")(argumentos),
    }),
    buscar_norma: tool({
      description:
        "Busca en la norma laboral colombiana (búsqueda híbrida). Úsala para jornada, recargos, descansos y dominicales. Cita los resultados en orden como [1], [2], …",
      inputSchema: buscarNormaEntrada,
      execute: async (argumentos) => ejecutar("buscar_norma")(argumentos),
    }),
    crear_propuesta: tool({
      description:
        "Deja una propuesta pendiente de aprobación. No escribe turnos ni ausencias. Úsala solo después de extraer la orden y consultar empleados, turnos y ausencias.",
      inputSchema: crearPropuestaEntrada,
      execute: async (argumentos) => {
        const resultado = await ejecutar("crear_propuesta")(argumentos);
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
  return Object.keys(herramientas(null));
}

async function recordar(
  deps: DepsAsistente | undefined,
  contenido: ContenidoMensaje,
): Promise<void> {
  try {
    await deps?.guardarAsistente?.(contenido);
  } catch {
    // La respuesta no depende de que el historial quede escrito.
  }
}

function contenidoAsistente(
  texto: string,
  tools: string[],
  propuestas: string[],
): ContenidoMensaje {
  return {
    parts: [
      { type: "text", text: texto },
      ...tools.map((nombre) => ({ type: "tool" as const, nombre })),
      ...propuestas.map((propuestaId) => ({
        type: "propuesta" as const,
        propuesta_id: propuestaId,
      })),
    ],
  };
}

/** Stream del asistente con router, tools MCP y el data part de intención. */
export async function responderConAsistente(
  cuerpo: CuerpoChat,
  pregunta: string,
  deps?: DepsAsistente,
): Promise<Response> {
  const usuario = deps?.usuario?.trim() || "anonimo";
  const { span, ctx } = abrirSpan(
    "relevo.turno",
    atributosTurno({
      conversacionId: deps?.conversacionId ?? null,
      usuario,
      intencion: FALLBACK.intencion,
      confianza: 0,
      entrada: pregunta,
    }),
  );

  try {
    return await context.with(ctx, async () => {
      let clasificacion = FALLBACK;
      try {
        clasificacion = await conSpan(
          "relevo.router",
          atributosLlm(pregunta),
          async (spanRouter) => {
            const resultado = deps?.clasificar
              ? await deps.clasificar(pregunta)
              : await clasificarIntencion(pregunta);
            spanRouter.setAttribute(
              SemanticConventions.OUTPUT_VALUE,
              resultado.intencion,
            );
            return resultado;
          },
        );
      } catch {
        clasificacion = FALLBACK;
      }
      span.setAttribute("intencion", clasificacion.intencion);
      span.setAttribute("confianza", clasificacion.confianza);

      let fallo = false;
      const alTerminar = () => cerrarSpan(span, fallo);
      const alFallar = () => {
        fallo = true;
        return "No se pudo completar la respuesta.";
      };

      if (clasificacion.intencion === "orden_escritura") {
        const procesar =
          deps?.procesarOrden ??
          ((orden: string) =>
            procesarOrdenEscritura(orden, {
              perfil: deps?.perfil,
              conversacionId: deps?.conversacionId,
            }));
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
            writer.write({ type: "text-start", id: "texto-orden" });
            writer.write({
              type: "text-delta",
              id: "texto-orden",
              delta: resultado.texto,
            });
            writer.write({ type: "text-end", id: "texto-orden" });
            span.setAttribute(
              SemanticConventions.OUTPUT_VALUE,
              recortar(resultado.texto),
            );
            const propuestas = resultado.ok
              ? [resultado.propuesta.propuesta_id]
              : [];
            const tools = resultado.ok
              ? [
                  "listar_empleados",
                  "consultar_turnos",
                  "consultar_ausencias",
                  "crear_propuesta",
                ]
              : [];
            await recordar(
              deps,
              contenidoAsistente(resultado.texto, tools, propuestas),
            );
          },
          onError: alFallar,
          onFinish: alTerminar,
        });
        return createUIMessageStreamResponse({ stream });
      }

      const redactar = async (base: string, llamoBuscarNorma: boolean) => {
        const citas = evaluarCitas(
          clasificacion.intencion,
          base,
          llamoBuscarNorma,
        );
        if (citas.anexar) {
          span.setAttribute("guardrail.citas", false);
          return anexarNotaCitas(base);
        }
        if (citas.aplica) {
          span.setAttribute("guardrail.citas", true);
        }
        return base;
      };

      const completarTexto = deps?.completarTexto;
      if (completarTexto) {
        const stream = createUIMessageStream<MensajeRelevo>({
          execute: async ({ writer }) => {
            writer.write({
              type: "data-intencion",
              id: "intencion",
              data: clasificacion,
            });
            const base = await completarTexto(pregunta);
            const visible = await redactar(base, false);
            writer.write({ type: "text-start", id: "texto-1" });
            writer.write({ type: "text-delta", id: "texto-1", delta: visible });
            writer.write({ type: "text-end", id: "texto-1" });
            span.setAttribute(SemanticConventions.OUTPUT_VALUE, recortar(visible));
            await recordar(deps, contenidoAsistente(visible, [], []));
          },
          onError: alFallar,
          onFinish: alTerminar,
        });
        return createUIMessageStreamResponse({ stream });
      }

      const modelo = crearModelo();
      if (!modelo) {
        throw new Error("Sin XAI_API_KEY");
      }

      const fecha = fechaBogota();
      const system = systemRelevo(fecha, clasificacion, deps?.perfil);
      const toolsLlamadas: string[] = [];
      const propuestas: string[] = [];
      const stream = createUIMessageStream<MensajeRelevo>({
        execute: async ({ writer }) => {
          writer.write({
            type: "data-intencion",
            id: "intencion",
            data: clasificacion,
          });
          const mensajes = await convertToModelMessages(mensajesParaModelo(cuerpo));
          const resultado = streamText({
            model: modelo,
            system,
            messages: mensajes,
            tools: herramientas(
              deps?.perfil ?? null,
              (propuesta) => {
                propuestas.push(propuesta.propuesta_id);
                writer.write({
                  type: "data-propuesta",
                  id: propuesta.propuesta_id,
                  data: propuesta,
                });
              },
              (nombre) => toolsLlamadas.push(nombre),
            ),
            stopWhen: stepCountIs(6),
            experimental_telemetry: {
              isEnabled: true,
              functionId: "relevo.modelo",
              recordInputs: true,
              recordOutputs: true,
            },
          });
          writer.merge(resultado.toUIMessageStream());
          const base = await resultado.text;
          const visible = await redactar(
            base,
            toolsLlamadas.includes("buscar_norma"),
          );
          if (visible !== base) {
            writer.write({ type: "text-start", id: "nota-citas" });
            writer.write({
              type: "text-delta",
              id: "nota-citas",
              delta: `\n\n${NOTA_CITAS}`,
            });
            writer.write({ type: "text-end", id: "nota-citas" });
          }
          span.setAttribute(SemanticConventions.OUTPUT_VALUE, recortar(visible));
          await recordar(
            deps,
            contenidoAsistente(visible, toolsLlamadas, propuestas),
          );
        },
        onError: alFallar,
        onFinish: alTerminar,
      });
      return createUIMessageStreamResponse({ stream });
    });
  } catch (error) {
    cerrarSpan(span, true);
    throw error;
  }
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
