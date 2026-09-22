import {
  context,
  trace,
  SpanStatusCode,
  type Attributes,
  type Context,
  type Span,
} from "@opentelemetry/api";
import {
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { MODELO_POR_DEFECTO } from "@/lib/agente/modelo";

const TOPE = 4000;

export function nombreModelo(): string {
  return process.env.RELEVO_MODELO?.trim() || MODELO_POR_DEFECTO;
}

export function recortar(valor: string): string {
  if (valor.length <= TOPE) {
    return valor;
  }
  return valor.slice(0, TOPE);
}

export function jsonCorto(valor: unknown): string {
  try {
    return recortar(JSON.stringify(valor));
  } catch {
    return "";
  }
}

function trazador() {
  return trace.getTracer("relevo", "0.1.0");
}

const cerrados = new WeakSet<Span>();

export function cerrarSpan(span: Span, conError = false): void {
  if (cerrados.has(span)) {
    return;
  }
  cerrados.add(span);
  span.setStatus({
    code: conError ? SpanStatusCode.ERROR : SpanStatusCode.OK,
  });
  span.end();
}

export async function conSpan<T>(
  nombre: string,
  atributos: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return trazador().startActiveSpan(nombre, { attributes: atributos }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      cerrarSpan(span, true);
      throw error;
    } finally {
      cerrarSpan(span);
    }
  });
}

export function abrirSpan(
  nombre: string,
  atributos: Attributes,
): { span: Span; ctx: Context } {
  const span = trazador().startSpan(nombre, { attributes: atributos });
  const ctx = trace.setSpan(context.active(), span);
  return { span, ctx };
}

export function atributosAgente(entrada: string): Attributes {
  return {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.AGENT,
    [SemanticConventions.INPUT_VALUE]: recortar(entrada),
  };
}

export function atributosLlm(entrada: string): Attributes {
  return {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
    [SemanticConventions.LLM_MODEL_NAME]: nombreModelo(),
    [SemanticConventions.INPUT_VALUE]: recortar(entrada),
  };
}

export function atributosTurno(datos: {
  conversacionId: string | null;
  usuario: string;
  intencion: string;
  confianza: number;
  entrada: string;
}): Attributes {
  return {
    ...atributosAgente(datos.entrada),
    conversacion_id: datos.conversacionId ?? "",
    usuario: datos.usuario,
    intencion: datos.intencion,
    confianza: datos.confianza,
  };
}

/** Span de tool. buscar_norma queda como RETRIEVER y lleva k. */
export async function trazarLlamada<T>(
  nombre: string,
  argumentos: Record<string, unknown>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const esNorma = nombre === "buscar_norma";
  const atributos: Attributes = {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: esNorma
      ? OpenInferenceSpanKind.RETRIEVER
      : OpenInferenceSpanKind.TOOL,
    [SemanticConventions.INPUT_VALUE]: jsonCorto(argumentos),
  };
  if (esNorma && typeof argumentos.k === "number") {
    atributos.k = argumentos.k;
  }
  return conSpan(`relevo.tool.${nombre}`, atributos, fn);
}
