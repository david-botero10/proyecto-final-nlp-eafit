import { randomUUID, timingSafeEqual } from "node:crypto";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import { solicitudSchema } from "../lib/a2a/esquemas";
import { atributosAgente, conSpan } from "../lib/observabilidad/spans";
import { redactarRazones } from "./razones";
import { verificar } from "./verificaciones";
import { construirVeredicto } from "./veredicto";

/**
 * Lógica A2A del auditor, independiente del transporte. La comparten el
 * servidor Node autónomo (`auditor/servidor.ts`) y las rutas de Next
 * (`app/a2a`, `app/.well-known/agent.json`).
 */

/** Tope del cuerpo JSON-RPC, en caracteres. */
export const TOPE_CUERPO = 1_000_000;

export const CABECERA_TOKEN = "x-auditor-token";

type IdRpc = string | number | null;

export type RespuestaRpc = Record<string, unknown>;

function errorRpc(id: IdRpc, codigo: number, mensaje: string): RespuestaRpc {
  return {
    jsonrpc: "2.0",
    id,
    error: { code: codigo, message: mensaje },
  };
}

/** Respuesta para un cuerpo que no se pudo leer (p. ej. excede el tope). */
export function errorCuerpoNoValido(): RespuestaRpc {
  return errorRpc(null, -32600, "La petición JSON-RPC no es válida.");
}

function idRpc(valor: unknown): IdRpc | undefined {
  if (valor === null || typeof valor === "string" || typeof valor === "number") {
    return valor;
  }
  return undefined;
}

function mensajeRegistro(error: unknown): string {
  if (!(error instanceof Error)) {
    return "error desconocido";
  }
  if (/password|postgresql:\/\//i.test(error.message)) {
    return "error de base de datos";
  }
  return error.message;
}

async function auditarCuerpo(datos: unknown) {
  const solicitud = solicitudSchema.parse(datos);
  const hallazgos = await verificar(solicitud);
  const veredicto = construirVeredicto(solicitud.propuesta_id, hallazgos);
  veredicto.razones = await redactarRazones(
    veredicto.razones,
    veredicto.veredicto,
  );
  return veredicto;
}

/**
 * Token compartido entre asistente y auditor. Sin `AUDITOR_TOKEN` configurado
 * no se exige nada (modo local). Con token, la comparación es de tiempo
 * constante.
 */
export function tokenAuditorValido(presentado: string | null | undefined): boolean {
  const esperado = process.env.AUDITOR_TOKEN?.trim();
  if (!esperado) {
    return true;
  }
  const recibido = Buffer.from(presentado ?? "", "utf8");
  const referencia = Buffer.from(esperado, "utf8");
  if (recibido.length !== referencia.length) {
    // Se compara igual contra sí mismo para no filtrar la longitud por tiempo.
    timingSafeEqual(referencia, referencia);
    return false;
  }
  return timingSafeEqual(recibido, referencia);
}

/** Procesa un cuerpo JSON-RPC 2.0 (`message/send`) y devuelve la respuesta. */
export async function procesarJsonRpc(texto: string): Promise<RespuestaRpc> {
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto) as unknown;
  } catch {
    return errorRpc(null, -32700, "El cuerpo no es JSON válido.");
  }

  if (Array.isArray(cuerpo) || !cuerpo || typeof cuerpo !== "object") {
    return errorCuerpoNoValido();
  }

  const peticion = cuerpo as Record<string, unknown>;
  const id = idRpc(peticion.id);
  if (
    peticion.jsonrpc !== "2.0" ||
    typeof peticion.method !== "string" ||
    id === undefined
  ) {
    return errorRpc(id ?? null, -32600, "La petición JSON-RPC no es válida.");
  }

  if (peticion.method === "tasks/get") {
    return errorRpc(id, -32001, "La tarea no está persistida.");
  }

  if (peticion.method !== "message/send") {
    return errorRpc(id, -32601, "Método no encontrado.");
  }

  const params = peticion.params;
  const message =
    params && typeof params === "object"
      ? (params as { message?: { parts?: unknown[] } }).message
      : undefined;
  const partes = message?.parts;
  const primera = Array.isArray(partes) ? partes[0] : undefined;
  const datos =
    primera &&
    typeof primera === "object" &&
    (primera as { kind?: unknown }).kind === "data"
      ? (primera as { data?: unknown }).data
      : undefined;
  if (datos === undefined) {
    return errorRpc(id, -32602, "Parámetros inválidos.");
  }

  const parsed = solicitudSchema.safeParse(datos);
  if (!parsed.success) {
    const detalle = parsed.error.issues[0]?.message ?? "revisa la solicitud";
    return errorRpc(id, -32602, `Parámetros inválidos. ${detalle}`);
  }

  try {
    const veredicto = await conSpan(
      "auditor.verificar",
      atributosAgente(parsed.data.propuesta_id),
      async (span) => {
        const obtenido = await auditarCuerpo(parsed.data);
        span.setAttribute("veredicto", obtenido.veredicto);
        span.setAttribute(SemanticConventions.OUTPUT_VALUE, obtenido.veredicto);
        return obtenido;
      },
    );
    return {
      jsonrpc: "2.0",
      id,
      result: {
        id: randomUUID(),
        contextId: veredicto.propuesta_id,
        kind: "task",
        status: { state: "completed" },
        artifacts: [
          {
            artifactId: randomUUID(),
            name: "veredicto_auditoria",
            parts: [{ kind: "data", data: veredicto }],
          },
        ],
      },
    };
  } catch (error) {
    console.error(`Auditor: ${mensajeRegistro(error)}`);
    return errorRpc(id, -32603, "No se pudo completar la auditoría.");
  }
}
