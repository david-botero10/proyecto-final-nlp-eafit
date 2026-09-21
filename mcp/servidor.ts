import path from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { crearCliente, type Sql } from "../lib/db/cliente";
import {
  buscarNorma,
  consultarAusencias,
  consultarTurnos,
  listarEmpleados,
} from "./consultas";
import {
  buscarNormaEntrada,
  buscarNormaSalida,
  consultarAusenciasEntrada,
  consultarAusenciasSalida,
  consultarTurnosEntrada,
  consultarTurnosSalida,
  listarEmpleadosEntrada,
  listarEmpleadosSalida,
} from "./esquemas";

const ANOTACION_LECTURA = { readOnlyHint: true as const };

function mensajeSeguro(error: unknown): string {
  if (error instanceof Error) {
    if (
      /ECONNREFUSED|connect|password|postgresql:\/\//i.test(error.message)
    ) {
      return "No se pudo consultar la base de datos.";
    }
    return error.message;
  }
  return "Ocurrió un error al ejecutar la consulta.";
}

function resultadoError(mensaje: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: mensaje }],
  };
}

function resultadoOk<T extends Record<string, unknown>>(datos: T) {
  return {
    structuredContent: datos,
    content: [{ type: "text" as const, text: JSON.stringify(datos) }],
  };
}

/** Construye el servidor MCP de lectura. No escribe en nómina. */
export function crearServidor(sql: Sql): McpServer {
  const servidor = new McpServer({
    name: "relevo",
    version: "0.1.0",
  });

  servidor.registerTool(
    "listar_empleados",
    {
      title: "Listar empleados",
      description:
        "Lista empleados sintéticos (id, nombre, rol, equipo), ordenados por nombre.",
      inputSchema: listarEmpleadosEntrada,
      outputSchema: listarEmpleadosSalida,
      annotations: ANOTACION_LECTURA,
    },
    async (filtros) => {
      try {
        const empleados = await listarEmpleados(sql, filtros);
        return resultadoOk({ empleados });
      } catch (error) {
        return resultadoError(mensajeSeguro(error));
      }
    },
  );

  servidor.registerTool(
    "consultar_turnos",
    {
      title: "Consultar turnos",
      description:
        "Asignaciones en un rango de fechas (máximo 92 días), con nombre, turno y estado.",
      inputSchema: consultarTurnosEntrada,
      outputSchema: consultarTurnosSalida,
      annotations: ANOTACION_LECTURA,
    },
    async (filtros) => {
      try {
        const asignaciones = await consultarTurnos(sql, filtros);
        return resultadoOk({ asignaciones });
      } catch (error) {
        return resultadoError(mensajeSeguro(error));
      }
    },
  );

  servidor.registerTool(
    "consultar_ausencias",
    {
      title: "Consultar ausencias",
      description:
        "Ausencias que se solapan con un rango de fechas (máximo 92 días).",
      inputSchema: consultarAusenciasEntrada,
      outputSchema: consultarAusenciasSalida,
      annotations: ANOTACION_LECTURA,
    },
    async (filtros) => {
      try {
        const ausencias = await consultarAusencias(sql, filtros);
        return resultadoOk({ ausencias });
      } catch (error) {
        return resultadoError(mensajeSeguro(error));
      }
    },
  );

  servidor.registerTool(
    "buscar_norma",
    {
      title: "Buscar norma",
      description:
        "Búsqueda híbrida del corpus normativo (vector bge-m3 + léxica en español, fusión RRF y re-ranking si el servicio responde). Si el servicio de embeddings no responde, queda solo la búsqueda léxica. Devuelve modo hibrida o lexica.",
      inputSchema: buscarNormaEntrada,
      outputSchema: buscarNormaSalida,
      annotations: ANOTACION_LECTURA,
    },
    async (filtros) => {
      try {
        const salida = await buscarNorma(sql, filtros);
        return resultadoOk(salida);
      } catch (error) {
        return resultadoError(mensajeSeguro(error));
      }
    },
  );

  return servidor;
}

function esEntradaPrincipal(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(argv1)).href;
}

async function main(): Promise<void> {
  const { sql } = crearCliente();
  const servidor = crearServidor(sql);
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);
}

if (esEntradaPrincipal()) {
  main().catch(() => {
    console.error("No se pudo arrancar el servidor MCP.");
    process.exit(1);
  });
}
