import type { Propuesta, VeredictoAuditor } from "../tipos";
import {
  agentCardSchema,
  solicitudSchema,
  tareaAuditoriaSchema,
  type AgentCard,
  type SolicitudAuditoria,
} from "./esquemas";

const URL_POR_DEFECTO = "http://127.0.0.1:8641";
const TIMEOUT_POR_DEFECTO_MS = 8000;

const tarjetas = new Map<string, AgentCard>();

export function urlAuditor(): string {
  const cruda = process.env.AUDITOR_URL?.trim() || URL_POR_DEFECTO;
  return cruda.replace(/\/$/, "");
}

export function timeoutAuditorMs(): number {
  const crudo = Number(process.env.AUDITOR_TIMEOUT_MS ?? TIMEOUT_POR_DEFECTO_MS);
  if (!Number.isFinite(crudo) || crudo <= 0) {
    return TIMEOUT_POR_DEFECTO_MS;
  }
  return crudo;
}

export function olvidarCacheAuditor(): void {
  tarjetas.clear();
}

/** Arma la solicitud A2A a partir de la propuesta del asistente. */
export function solicitudDesdePropuesta(
  propuesta: Propuesta,
): SolicitudAuditoria {
  return solicitudSchema.parse({
    propuesta_id: propuesta.propuesta_id,
    orden_texto: propuesta.orden_texto,
    extraccion: propuesta.extraccion,
    acciones: propuesta.acciones,
    contexto: propuesta.contexto,
  });
}

function urlA2a(tarjeta: AgentCard): string {
  return `${tarjeta.url.replace(/\/$/, "")}/a2a`;
}

async function obtenerTarjeta(
  base: string,
  signal: AbortSignal,
): Promise<AgentCard | null> {
  const cacheada = tarjetas.get(base);
  if (cacheada) {
    return cacheada;
  }
  const respuesta = await fetch(`${base}/.well-known/agent.json`, { signal });
  if (!respuesta.ok) {
    return null;
  }
  const tarjeta = agentCardSchema.parse(await respuesta.json());
  tarjetas.set(base, tarjeta);
  return tarjeta;
}

/**
 * Envía la solicitud al auditor. `null` si el servicio no responde,
 * la tarjeta no valida o el veredicto no cumple el contrato.
 */
export async function auditarSolicitud(
  solicitud: SolicitudAuditoria,
): Promise<VeredictoAuditor | null> {
  try {
    const base = urlAuditor();
    const signal = AbortSignal.timeout(timeoutAuditorMs());
    const tarjeta = await obtenerTarjeta(base, signal);
    if (!tarjeta) {
      return null;
    }
    const id = crypto.randomUUID();
    const respuesta = await fetch(urlA2a(tarjeta), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [{ kind: "data", data: solicitud }],
          },
        },
      }),
      signal,
    });
    if (!respuesta.ok) {
      return null;
    }
    const cuerpo = (await respuesta.json()) as {
      id?: unknown;
      error?: unknown;
      result?: unknown;
    };
    if (cuerpo.error || cuerpo.id !== id) {
      return null;
    }
    const tarea = tareaAuditoriaSchema.parse(cuerpo.result);
    return tarea.artifacts[0].parts[0].data;
  } catch {
    return null;
  }
}

/** Firma que usa el asistente. `null` si el auditor no contesta a tiempo. */
export async function auditarPropuesta(
  propuesta: Propuesta,
): Promise<VeredictoAuditor | null> {
  try {
    return await auditarSolicitud(solicitudDesdePropuesta(propuesta));
  } catch {
    return null;
  }
}
