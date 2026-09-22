import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { crearCliente, type ClienteSql, type Sql } from "../lib/db/cliente";
import { crearServidor } from "../mcp/servidor";
import { horasEntre } from "./horas";

type SqlReservada = Sql & { release: () => void };

type ClienteAuditor = {
  llamar: (
    nombre: string,
    argumentos: Record<string, unknown>,
  ) => Promise<unknown>;
  cerrar: () => Promise<void>;
};

const clientes = new Map<string, Promise<ClienteAuditor>>();
let pool: ClienteSql | null = null;

function obtenerPool(): ClienteSql {
  if (!pool) {
    pool = crearCliente();
  }
  return pool;
}

async function reservar(): Promise<SqlReservada> {
  const sql = obtenerPool().sql as Sql & {
    reserve: () => Promise<SqlReservada>;
  };
  return sql.reserve();
}

/**
 * El auditor adopta `relevo_lector` en su propia conexión.
 * Si el rol no puede asumirse, las tools siguen siendo solo SELECT.
 */
async function adoptarLector(sql: Sql): Promise<void> {
  try {
    await sql`SET ROLE relevo_lector`;
  } catch {
    // La conexión de aplicación conserva SELECT. No se registra el DSN.
  }
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

async function llamarHerramienta(
  cliente: Client,
  nombre: string,
  argumentos: Record<string, unknown>,
): Promise<unknown> {
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

async function conectar(nombre: string): Promise<ClienteAuditor> {
  const reservada = await reservar();
  let servidor: McpServer | null = null;
  let cliente: Client | null = null;
  try {
    await adoptarLector(reservada);
    servidor = crearServidor(reservada);
    cliente = new Client({
      name: `relevo-auditor-${nombre}`,
      version: "0.1.0",
    });
    const [transporteCliente, transporteServidor] =
      InMemoryTransport.createLinkedPair();
    const clienteListo = cliente;
    const servidorListo = servidor;
    await Promise.all([
      clienteListo.connect(transporteCliente),
      servidorListo.connect(transporteServidor),
    ]);
    return {
      llamar: (herramienta, argumentos) =>
        llamarHerramienta(clienteListo, herramienta, argumentos),
      cerrar: async () => {
        await clienteListo.close();
        await servidorListo.close();
        reservada.release();
      },
    };
  } catch (error) {
    if (cliente) {
      await cliente.close().catch(() => undefined);
    }
    if (servidor) {
      await servidor.close().catch(() => undefined);
    }
    reservada.release();
    throw error;
  }
}

/** Un cliente MCP en proceso por verificación, distinto del asistente. */
export function obtenerClienteAuditor(nombre: string): Promise<ClienteAuditor> {
  let pendiente = clientes.get(nombre);
  if (!pendiente) {
    pendiente = conectar(nombre).catch((error: unknown) => {
      clientes.delete(nombre);
      throw error;
    });
    clientes.set(nombre, pendiente);
  }
  return pendiente;
}

let horasCache: Promise<Map<string, number>> | null = null;

async function leerHoras(): Promise<Map<string, number>> {
  const sql = await reservar();
  try {
    await adoptarLector(sql);
    const filas = await sql<
      {
        codigo: string;
        hora_inicio: string;
        hora_fin: string;
        cruza_medianoche: boolean;
      }[]
    >`
      SELECT btrim(codigo) AS codigo,
             hora_inicio::text AS hora_inicio,
             hora_fin::text AS hora_fin,
             cruza_medianoche
      FROM turnos
    `;
    const mapa = new Map<string, number>();
    for (const fila of filas) {
      mapa.set(
        fila.codigo.trim(),
        horasEntre(fila.hora_inicio, fila.hora_fin, fila.cruza_medianoche),
      );
    }
    if (!mapa.has("M") || !mapa.has("T") || !mapa.has("N")) {
      throw new Error("El catálogo de turnos no tiene M, T y N.");
    }
    return mapa;
  } finally {
    sql.release();
  }
}

/** Horas reales de `turnos`. `consultar_turnos` no las devuelve. */
export function horasDeTurno(): Promise<Map<string, number>> {
  if (!horasCache) {
    horasCache = leerHoras().catch((error: unknown) => {
      horasCache = null;
      throw error;
    });
  }
  return horasCache;
}

export async function cerrarClientesAuditor(): Promise<void> {
  const pendientes = [...clientes.values()];
  clientes.clear();
  horasCache = null;
  for (const pendiente of pendientes) {
    try {
      const cliente = await pendiente;
      await cliente.cerrar();
    } catch {
      // Un cliente que no conectó no impide cerrar el resto.
    }
  }
  if (pool) {
    const actual = pool;
    pool = null;
    await actual.cerrar();
  }
}
