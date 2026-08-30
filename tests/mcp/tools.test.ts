/** @vitest-environment node */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearCliente, type Sql } from "@/lib/db/cliente";
import { crearServidor } from "@/mcp/servidor";

async function hayBase(): Promise<boolean> {
  const cliente = crearCliente();
  try {
    await cliente.sql`SELECT 1 AS ok`;
    return true;
  } catch {
    return false;
  } finally {
    await cliente.cerrar();
  }
}

const bdActiva = await hayBase();
if (!bdActiva) {
  console.warn(
    "Se omite la suite MCP: no hay PostgreSQL accesible. Arranca docker compose up -d db, luego db/migrate.py y db/seed.py.",
  );
}

function textoHerramienta(resultado: {
  isError?: boolean;
  content?: unknown;
  structuredContent?: unknown;
}): string {
  return JSON.stringify(resultado);
}

describe.skipIf(!bdActiva)("tools MCP de lectura", () => {
  let sql: Sql;
  let cerrar: () => Promise<void>;
  let servidor: McpServer;
  let cliente: Client;

  beforeAll(async () => {
    const conexion = crearCliente();
    sql = conexion.sql;
    cerrar = conexion.cerrar;
    servidor = crearServidor(sql);
    cliente = new Client({ name: "tests-mcp", version: "0.1.0" });
    const [transporteCliente, transporteServidor] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor),
    ]);
  });

  afterAll(async () => {
    await cliente.close();
    await servidor.close();
    await cerrar();
  });

  it("listar_empleados devuelve 40 y filtra por equipo (20/10/10)", async () => {
    const todos = await cliente.callTool({
      name: "listar_empleados",
      arguments: {},
    });
    expect(todos.isError).toBeFalsy();
    const cuerpo = todos.structuredContent as {
      empleados: { id: number; nombre: string; rol: string; equipo: string }[];
    };
    expect(cuerpo.empleados).toHaveLength(40);

    const porEquipo = async (equipo: string) => {
      const r = await cliente.callTool({
        name: "listar_empleados",
        arguments: { equipo },
      });
      const datos = r.structuredContent as { empleados: { equipo: string }[] };
      return datos.empleados;
    };

    const enfermeria = await porEquipo("enfermeria");
    const recepcion = await porEquipo("recepcion");
    const vigilancia = await porEquipo("vigilancia");
    expect(enfermeria).toHaveLength(20);
    expect(recepcion).toHaveLength(10);
    expect(vigilancia).toHaveLength(10);
    expect(enfermeria.every((e) => e.equipo === "enfermeria")).toBe(true);
  });

  it("consultar_turnos de un empleado del seed respeta la semana y el filtro turno", async () => {
    const semana = await cliente.callTool({
      name: "consultar_turnos",
      arguments: {
        empleado: 1,
        desde: "2026-08-03",
        hasta: "2026-08-08",
      },
    });
    expect(semana.isError).toBeFalsy();
    const cuerpo = semana.structuredContent as {
      asignaciones: {
        empleado: string;
        turno: string;
        turno_nombre: string;
        fecha: string;
        estado: string;
      }[];
    };
    expect(cuerpo.asignaciones.length).toBeGreaterThan(0);
    expect(
      cuerpo.asignaciones.every((a) => a.empleado.includes("María Marcela")),
    ).toBe(true);
    expect(cuerpo.asignaciones.every((a) => a.turno === "M")).toBe(true);

    const tardes = await cliente.callTool({
      name: "consultar_turnos",
      arguments: {
        empleado: "María Marcela",
        desde: "2026-08-03",
        hasta: "2026-08-08",
        turno: "T",
      },
    });
    const cuerpoT = tardes.structuredContent as {
      asignaciones: unknown[];
    };
    expect(cuerpoT.asignaciones).toHaveLength(0);
  });

  it("consultar_ausencias filtra por tipo y rango", async () => {
    const resultado = await cliente.callTool({
      name: "consultar_ausencias",
      arguments: {
        tipo: "incapacidad",
        desde: "2026-08-01",
        hasta: "2026-08-31",
      },
    });
    expect(resultado.isError).toBeFalsy();
    const cuerpo = resultado.structuredContent as {
      ausencias: {
        empleado: string;
        tipo: string;
        fecha_inicio: string;
        fecha_fin: string;
        estado: string;
        motivo: string | null;
      }[];
    };
    expect(cuerpo.ausencias.length).toBeGreaterThan(0);
    expect(cuerpo.ausencias.every((a) => a.tipo === "incapacidad")).toBe(true);
    expect(
      cuerpo.ausencias.every(
        (a) => a.fecha_inicio <= "2026-08-31" && a.fecha_fin >= "2026-08-01",
      ),
    ).toBe(true);
  });

  it("buscar_norma rankea el fixture de recargo nocturno y limpia", async () => {
    const titulo = "b1-mcp-fixture-recargo-nocturno";
    const [documento] = await sql<{ id: number }[]>`
      INSERT INTO documentos (titulo, fuente, tipo, url, hash_sha256)
      VALUES (
        ${titulo},
        'CST',
        'ley',
        'https://example.test/b1-mcp',
        'b1-mcp-test-fixture'
      )
      RETURNING id
    `;
    try {
      const [recargo, dominical] = await sql<{ id: number }[]>`
        INSERT INTO chunks (documento_id, ref, texto, embedding)
        VALUES
          (
            ${documento.id},
            'art. 168',
            'El recargo nocturno es del treinta y cinco por ciento sobre el valor del trabajo diurno. Este artículo trata el recargo nocturno de la jornada.',
            NULL
          ),
          (
            ${documento.id},
            'art. 179',
            'El descanso dominical es obligatorio para el trabajador. El trabajo en domingo no se confunde con el recargo nocturno de la jornada ordinaria.',
            NULL
          )
        RETURNING id
      `;

      // k amplio: con el corpus real indexado, los fixtures compiten con
      // artículos verdaderos del CST y no tienen por qué quedar de primeros.
      const resultado = await cliente.callTool({
        name: "buscar_norma",
        arguments: { consulta: "recargo nocturno", k: 50 },
      });
      expect(resultado.isError).toBeFalsy();
      const cuerpo = resultado.structuredContent as {
        resultados: {
          chunk_id: number;
          ref: string | null;
          fuente: string;
          titulo: string;
          url: string | null;
          fragmento: string;
          score: number;
        }[];
      };
      const filaRecargo = cuerpo.resultados.find(
        (r) => r.chunk_id === recargo.id,
      );
      const filaDominical = cuerpo.resultados.find(
        (r) => r.chunk_id === dominical.id,
      );
      expect(filaRecargo).toBeDefined();
      expect(filaRecargo?.score ?? 0).toBeGreaterThan(filaDominical?.score ?? 0);
      const puntajes = cuerpo.resultados.map((r) => r.score);
      expect(puntajes).toEqual([...puntajes].sort((a, b) => b - a));
      expect(filaRecargo?.fragmento.toLowerCase()).toMatch(/recargo/);
    } finally {
      await sql`DELETE FROM chunks WHERE documento_id = ${documento.id}`;
      await sql`DELETE FROM documentos WHERE id = ${documento.id}`;
    }
  });

  it("fechas invertidas producen error Zod/mensaje y no crash", async () => {
    let lanzado: unknown;
    let resultado:
      | { isError?: boolean; content?: unknown; structuredContent?: unknown }
      | undefined;
    try {
      resultado = await cliente.callTool({
        name: "consultar_turnos",
        arguments: {
          desde: "2026-08-10",
          hasta: "2026-08-01",
        },
      });
    } catch (error) {
      lanzado = error;
    }
    expect(lanzado ?? resultado?.isError).toBeTruthy();
    expect(textoHerramienta(resultado ?? { content: String(lanzado) })).toMatch(
      /desde|hasta|fecha|posterior|inválid|invalid/i,
    );
  });
});
