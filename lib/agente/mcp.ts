import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Span } from "@opentelemetry/api";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";
import { crearCliente } from "@/lib/db/cliente";
import {
  aplicarAlcance,
  filtrarResultado,
  type PerfilAlcance,
} from "@/lib/guardrails/alcance";
import { jsonCorto, trazarLlamada } from "@/lib/observabilidad/spans";
import { crearServidor } from "@/mcp/servidor";

let pendiente: Promise<Client> | null = null;

/**
 * Cliente MCP en proceso, perezoso y único.
 * Las tools del asistente solo hablan con el servidor por este contrato.
 */
export function obtenerClienteMcp(): Promise<Client> {
  if (!pendiente) {
    pendiente = conectar().catch((error: unknown) => {
      pendiente = null;
      throw error;
    });
  }
  return pendiente;
}

async function conectar(): Promise<Client> {
  const { sql } = crearCliente();
  const servidor = crearServidor(sql);
  const cliente = new Client({ name: "relevo-asistente", version: "0.1.0" });
  const [transporteCliente, transporteServidor] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    cliente.connect(transporteCliente),
    servidor.connect(transporteServidor),
  ]);
  return cliente;
}

function textoContenido(contenido: unknown): string {
  if (!Array.isArray(contenido)) {
    return "";
  }
  return contenido
    .map((bloque) => {
      if (
        bloque &&
        typeof bloque === "object" &&
        "text" in bloque &&
        typeof bloque.text === "string"
      ) {
        return bloque.text;
      }
      return "";
    })
    .filter((texto) => texto.length > 0)
    .join("\n");
}

/** Delega en `cliente.callTool`. No abre otra vía a la base. */
async function llamarMcp(
  nombre: string,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
  const cliente = await obtenerClienteMcp();
  const resultado = await cliente.callTool({
    name: nombre,
    arguments: argumentos,
  });
  if (resultado.isError) {
    const texto = textoContenido(resultado.content);
    return {
      error: texto.length > 0 ? texto : "No se pudo ejecutar la herramienta.",
    };
  }
  if (
    resultado.structuredContent &&
    typeof resultado.structuredContent === "object"
  ) {
    return resultado.structuredContent;
  }
  return { texto: textoContenido(resultado.content) };
}

function anotarModo(span: Span, resultado: unknown): void {
  if (!resultado || typeof resultado !== "object" || !("modo" in resultado)) {
    return;
  }
  const modo = (resultado as { modo?: unknown }).modo;
  if (typeof modo === "string") {
    span.setAttribute("modo", modo);
  }
}

/**
 * Tool del asistente, con span y alcance por equipo.
 * El perfil vacío no recorta: así siguen pasando las llamadas internas del flujo.
 */
export async function llamarHerramienta(
  nombre: string,
  argumentos: Record<string, unknown>,
  opciones?: { perfil?: PerfilAlcance | null },
): Promise<unknown> {
  const ajustado = await aplicarAlcance(
    nombre,
    argumentos,
    opciones?.perfil ?? null,
    llamarMcp,
  );
  if ("error" in ajustado) {
    return trazarLlamada(nombre, argumentos, async (span) => {
      span.setAttribute(SemanticConventions.OUTPUT_VALUE, ajustado.error);
      return { error: ajustado.error };
    });
  }
  return trazarLlamada(nombre, ajustado.args, async (span) => {
    const resultado = await llamarMcp(nombre, ajustado.args);
    if (nombre === "buscar_norma") {
      anotarModo(span, resultado);
    }
    const filtrado = filtrarResultado(nombre, resultado, ajustado.roster);
    span.setAttribute(SemanticConventions.OUTPUT_VALUE, jsonCorto(filtrado));
    return filtrado;
  });
}
