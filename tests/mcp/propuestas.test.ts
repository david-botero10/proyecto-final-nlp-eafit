/** @vitest-environment node */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/propuestas/[id]/decision/route";
import { GET } from "@/app/api/propuestas/[id]/route";
import { crearCliente, type Sql } from "@/lib/db/cliente";
import {
  crearPropuesta,
  ejecutarPropuesta,
  extraccionElegida,
  type EntradaCrear,
} from "@/mcp/escrituras";
import { crearServidor } from "@/mcp/servidor";
import type { Accion, Extraccion } from "@/lib/tipos";

const HOY = "2026-09-21";
const LIBRE = "2026-09-28";
const PREFIJO = "d1-test:";

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
  console.warn("Se omite la suite de propuestas: no hay PostgreSQL en 5432.");
}

function extraccion(parcial: Partial<Extraccion> = {}): Extraccion {
  return {
    empleado: "María Marcela Torres",
    turno: "M",
    fechas: [LIBRE],
    justificacion: null,
    accion: "asignar",
    proveedor: "xai",
    ...parcial,
  };
}

function asignar(
  fecha: string,
  turno: "M" | "T" | "N" = "M",
  empleadoId = 1,
): Accion {
  return {
    tipo: "asignar_turno",
    empleado_id: empleadoId,
    turno,
    fecha,
  };
}

async function limpiar(sql: Sql): Promise<void> {
  await sql`
    UPDATE asignaciones
    SET estado = 'programada', propuesta_id = NULL
    WHERE origen = 'seed'
      AND propuesta_id IN (
        SELECT id FROM propuestas WHERE orden_texto LIKE ${PREFIJO + "%"}
      )
  `;
  await sql`
    DELETE FROM asignaciones
    WHERE origen = 'tarjeta'
      AND propuesta_id IN (
        SELECT id FROM propuestas WHERE orden_texto LIKE ${PREFIJO + "%"}
      )
  `;
  await sql`
    DELETE FROM ausencias
    WHERE propuesta_id IN (
      SELECT id FROM propuestas WHERE orden_texto LIKE ${PREFIJO + "%"}
    )
  `;
  await sql`
    DELETE FROM pares_preferencia
    WHERE propuesta_id IN (
      SELECT id FROM propuestas WHERE orden_texto LIKE ${PREFIJO + "%"}
    )
  `;
  await sql`
    DELETE FROM aprobaciones
    WHERE propuesta_id IN (
      SELECT id FROM propuestas WHERE orden_texto LIKE ${PREFIJO + "%"}
    )
  `;
  await sql`DELETE FROM propuestas WHERE orden_texto LIKE ${PREFIJO + "%"}`;
  await sql`DELETE FROM empleados WHERE documento = 'd1-test-inactivo'`;
}

describe.skipIf(!bdActiva)("propuestas y ejecución", () => {
  let sql: Sql;
  let cerrar: () => Promise<void>;
  let servidor: McpServer;
  let cliente: Client;

  beforeAll(async () => {
    const conexion = crearCliente();
    sql = conexion.sql;
    cerrar = conexion.cerrar;
    await limpiar(sql);
    servidor = crearServidor(sql);
    cliente = new Client({ name: "tests-d1", version: "0.1.0" });
    const [transporteCliente, transporteServidor] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor),
    ]);
  });

  afterAll(async () => {
    await limpiar(sql);
    await cliente.close();
    await servidor.close();
    await cerrar();
  });

  async function crear(entrada: Partial<EntradaCrear> & { orden: string; acciones: Accion[] }) {
    return crearPropuesta(sql, {
      orden_texto: PREFIJO + entrada.orden,
      extraccion: entrada.extraccion ?? extraccion({ fechas: fechasDe(entrada.acciones) }),
      acciones: entrada.acciones,
      hoy: entrada.hoy ?? HOY,
      usuario: entrada.usuario,
    });
  }

  it("no expone ejecutar_propuesta y anota crear_propuesta", async () => {
    const lista = await cliente.listTools();
    const nombres = lista.tools.map((tool) => tool.name);
    expect(nombres).toContain("crear_propuesta");
    expect(nombres).not.toContain("ejecutar_propuesta");
    const tool = lista.tools.find((item) => item.name === "crear_propuesta");
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
  });

  it("rechaza un empleado inexistente", async () => {
    await expect(
      crear({
        orden: "inexistente",
        acciones: [asignar(LIBRE, "M", 999_999)],
      }),
    ).rejects.toThrow(/no existe o no está activo/);
  });

  it("rechaza un empleado inactivo", async () => {
    const [fila] = await sql<{ id: number }[]>`
      INSERT INTO empleados (nombre, documento, rol, equipo, fecha_ingreso, activo)
      VALUES (
        'Inactivo D1',
        'd1-test-inactivo',
        'prueba',
        'enfermeria',
        DATE '2026-01-01',
        false
      )
      RETURNING id
    `;
    await expect(
      crear({
        orden: "inactivo",
        acciones: [asignar(LIBRE, "M", fila.id)],
      }),
    ).rejects.toThrow(/no existe o no está activo/);
  });

  it("rechaza una fecha fuera de 92 días", async () => {
    await expect(
      crear({
        orden: "lejos",
        acciones: [asignar("2020-01-01")],
      }),
    ).rejects.toThrow(/fuera de la ventana de 92 días/);
  });

  it("detecta el solape con una asignación del seed y queda pendiente", async () => {
    const antes = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM asignaciones WHERE origen = 'tarjeta'
    `;
    const propuesta = await crear({
      orden: "solape",
      acciones: [asignar("2026-09-21", "M", 1)],
      extraccion: extraccion({
        turno: "M",
        fechas: ["2026-09-21"],
      }),
    });
    expect(propuesta.estado).toBe("pendiente");
    expect(
      propuesta.contexto.solapes_detectados.some(
        (solape) =>
          solape.empleado_id === 1 &&
          solape.fecha === "2026-09-21" &&
          solape.turno === "T",
      ),
    ).toBe(true);
    const despues = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM asignaciones WHERE origen = 'tarjeta'
    `;
    expect(despues[0].n).toBe(antes[0].n);

    const leida = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: propuesta.propuesta_id }),
    });
    expect(leida.status).toBe(200);
    const cuerpo = (await leida.json()) as { estado: string; orden_texto: string };
    expect(cuerpo.estado).toBe("pendiente");
    expect(cuerpo.orden_texto).toContain("solape");
  });

  it("reporta una ausencia aprobada del seed en el contexto", async () => {
    const propuesta = await crear({
      orden: "ausencia-solape",
      acciones: [asignar("2026-08-05", "M", 11)],
      extraccion: extraccion({
        empleado: "Javier Fredy Narváez",
        fechas: ["2026-08-05"],
      }),
    });
    expect(
      propuesta.contexto.ausencias_en_rango.some(
        (ausencia) =>
          ausencia.empleado_id === 11 && ausencia.tipo === "incapacidad",
      ),
    ).toBe(true);
  });

  it("aprobar escribe la acción congelada, el par y no acepta otra decisión", async () => {
    const acciones = [asignar(LIBRE, "M", 1)];
    const base = extraccion({ turno: "M", fechas: [LIBRE] });
    const propuesta = await crear({
      orden: "aprobar",
      acciones,
      extraccion: base,
    });
    const resumen = await ejecutarPropuesta(sql, {
      propuesta_id: propuesta.propuesta_id,
      decision: "aprobar",
      correccion: [asignar(LIBRE, "N", 1)],
      usuario: "coordinador",
      hoy: HOY,
    });
    expect(resumen.estado).toBe("aprobada");
    expect(resumen.filas).toEqual({
      asignaciones: 1,
      ausencias: 0,
      cancelaciones: 0,
    });

    const filas = await sql<
      { turno: string; origen: string; estado: string }[]
    >`
      SELECT btrim(t.codigo) AS turno, a.origen, a.estado
      FROM asignaciones a
      JOIN turnos t ON t.id = a.turno_id
      WHERE a.propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(filas).toEqual([{ turno: "M", origen: "tarjeta", estado: "programada" }]);

    const [aprobacion] = await sql<{ decision: string; correccion: unknown }[]>`
      SELECT decision, correccion
      FROM aprobaciones
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(aprobacion.decision).toBe("aprobar");
    expect(aprobacion.correccion).toBeNull();

    const [par] = await sql<{ origen: string; elegida: Extraccion; rechazada: unknown }[]>`
      SELECT origen, elegida, rechazada
      FROM pares_preferencia
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(par.origen).toBe("aprobacion");
    expect(par.elegida).toMatchObject(base);
    expect(par.rechazada).toBeNull();

    await expect(
      ejecutarPropuesta(sql, {
        propuesta_id: propuesta.propuesta_id,
        decision: "rechazar",
        usuario: "coordinador",
        hoy: HOY,
      }),
    ).rejects.toThrow(/ya fue decidida/);

    const siguen = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM asignaciones
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(siguen[0].n).toBe(1);

    const [quien] = await sql<{ current_user: string }[]>`SELECT current_user`;
    expect(quien.current_user).toBe("relevo");
  });

  it("corregir escribe la corrección y guarda la extracción original como rechazada", async () => {
    const original = extraccion({ turno: "M", fechas: [LIBRE] });
    const propuesta = await crear({
      orden: "corregir",
      acciones: [asignar(LIBRE, "M", 1)],
      extraccion: original,
    });
    const correccion = [asignar(LIBRE, "T", 1)];
    const resumen = await ejecutarPropuesta(sql, {
      propuesta_id: propuesta.propuesta_id,
      decision: "corregir",
      correccion,
      usuario: "coordinador",
      hoy: HOY,
    });
    expect(resumen.filas.asignaciones).toBe(1);
    expect(resumen.estado).toBe("corregida");

    const filas = await sql<{ turno: string; origen: string }[]>`
      SELECT btrim(t.codigo) AS turno, a.origen
      FROM asignaciones a
      JOIN turnos t ON t.id = a.turno_id
      WHERE a.propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(filas).toEqual([{ turno: "T", origen: "tarjeta" }]);

    const [par] = await sql<{ origen: string; elegida: Extraccion; rechazada: Extraccion }[]>`
      SELECT origen, elegida, rechazada
      FROM pares_preferencia
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(par.origen).toBe("correccion");
    expect(par.rechazada).toMatchObject(original);
    expect(par.elegida).toMatchObject(extraccionElegida(original, correccion));
  });

  it("rechazar no toca la nómina y guarda el par de rechazo", async () => {
    const original = extraccion({ turno: "N", fechas: [LIBRE] });
    const antes = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM asignaciones
    `;
    const propuesta = await crear({
      orden: "rechazar",
      acciones: [asignar(LIBRE, "N", 1)],
      extraccion: original,
    });
    const resumen = await ejecutarPropuesta(sql, {
      propuesta_id: propuesta.propuesta_id,
      decision: "rechazar",
      usuario: "coordinador",
      hoy: HOY,
    });
    expect(resumen.filas).toEqual({
      asignaciones: 0,
      ausencias: 0,
      cancelaciones: 0,
    });
    const despues = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM asignaciones
    `;
    expect(despues[0].n).toBe(antes[0].n);
    const suyas = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM asignaciones
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(suyas[0].n).toBe(0);
    const [par] = await sql<{ origen: string; elegida: unknown; rechazada: Extraccion }[]>`
      SELECT origen, elegida, rechazada
      FROM pares_preferencia
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(par.origen).toBe("rechazo");
    expect(par.elegida).toBeNull();
    expect(par.rechazada).toMatchObject(original);
  });

  it("aprobar una ausencia escribe la fila ligada a la propuesta", async () => {
    const accion: Accion = {
      tipo: "registrar_ausencia",
      empleado_id: 1,
      tipo_ausencia: "permiso",
      fecha_inicio: LIBRE,
      fecha_fin: "2026-09-29",
      motivo: "trámite",
    };
    const propuesta = await crear({
      orden: "ausencia",
      acciones: [accion],
      extraccion: extraccion({
        turno: null,
        accion: "ausencia",
        fechas: [LIBRE, "2026-09-29"],
        justificacion: "trámite",
      }),
    });
    const resumen = await ejecutarPropuesta(sql, {
      propuesta_id: propuesta.propuesta_id,
      decision: "aprobar",
      usuario: "coordinador",
      hoy: HOY,
    });
    expect(resumen.filas.ausencias).toBe(1);
    const [fila] = await sql<
      { tipo: string; estado: string; motivo: string; inicio: string; fin: string }[]
    >`
      SELECT tipo, estado, motivo, fecha_inicio::text AS inicio, fecha_fin::text AS fin
      FROM ausencias
      WHERE propuesta_id = ${propuesta.propuesta_id}::uuid
    `;
    expect(fila).toEqual({
      tipo: "permiso",
      estado: "aprobada",
      motivo: "trámite",
      inicio: LIBRE,
      fin: "2026-09-29",
    });
  });

  it("cancelar marca la fila del seed y la limpieza la restaura", async () => {
    const [previa] = await sql<{ estado: string; origen: string }[]>`
      SELECT estado, origen
      FROM asignaciones
      WHERE empleado_id = 1 AND fecha = DATE '2026-09-21'
    `;
    expect(previa.origen).toBe("seed");
    const propuesta = await crear({
      orden: "cancelar",
      acciones: [
        { tipo: "cancelar_turno", empleado_id: 1, fecha: "2026-09-21" },
      ],
      extraccion: extraccion({
        turno: null,
        accion: "quitar",
        fechas: ["2026-09-21"],
      }),
    });
    const resumen = await ejecutarPropuesta(sql, {
      propuesta_id: propuesta.propuesta_id,
      decision: "aprobar",
      usuario: "coordinador",
      hoy: HOY,
    });
    expect(resumen.filas.cancelaciones).toBe(1);
    const [fila] = await sql<{ estado: string; origen: string }[]>`
      SELECT estado, origen
      FROM asignaciones
      WHERE empleado_id = 1 AND fecha = DATE '2026-09-21'
    `;
    expect(fila.estado).toBe("cancelada");
    expect(fila.origen).toBe("seed");
    await limpiar(sql);
    const [restaurada] = await sql<{ estado: string; propuesta_id: string | null }[]>`
      SELECT estado, propuesta_id::text
      FROM asignaciones
      WHERE empleado_id = 1 AND fecha = DATE '2026-09-21'
    `;
    expect(restaurada.estado).toBe("programada");
    expect(restaurada.propuesta_id).toBeNull();
  });

  it("el endpoint responde 404 si la propuesta no existe", async () => {
    const respuesta = await POST(
      new Request("http://localhost/api/propuestas/x/decision", {
        method: "POST",
        body: JSON.stringify({ decision: "aprobar", usuario: "coordinador" }),
      }),
      {
        params: Promise.resolve({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      },
    );
    expect(respuesta.status).toBe(404);
    const cuerpo = (await respuesta.json()) as { error: string };
    expect(cuerpo.error).toMatch(/No existe/);
    expect(cuerpo.error).not.toMatch(/postgresql:\/\//);
  });
});

function fechasDe(acciones: Accion[]): string[] {
  return acciones.flatMap((accion) =>
    accion.tipo === "registrar_ausencia"
      ? [accion.fecha_inicio, accion.fecha_fin]
      : [accion.fecha],
  );
}

describe("decisión HTTP", () => {
  it("un cuerpo inválido responde 400", async () => {
    const respuesta = await POST(
      new Request("http://localhost/api/propuestas/x/decision", {
        method: "POST",
        body: JSON.stringify({ decision: "aprobar" }),
      }),
      {
        params: Promise.resolve({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      },
    );
    expect(respuesta.status).toBe(400);
  });

  it("JSON inválido responde 400", async () => {
    const respuesta = await POST(
      new Request("http://localhost/api/propuestas/x/decision", {
        method: "POST",
        body: "{",
      }),
      {
        params: Promise.resolve({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      },
    );
    expect(respuesta.status).toBe(400);
  });
});
