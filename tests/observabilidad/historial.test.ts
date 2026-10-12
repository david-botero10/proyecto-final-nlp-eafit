/** @vitest-environment node */
import { afterAll, describe, expect, it } from "vitest";
import { GET as listar } from "@/app/api/conversaciones/route";
import { DELETE as borrar } from "@/app/api/conversaciones/[id]/route";
import { crearCliente } from "@/lib/db/cliente";
import {
  asegurarConversacion,
  eliminarConversacion,
  guardarMensaje,
  listarConversaciones,
} from "@/lib/memoria/conversaciones";

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
const SUFIJO = crypto.randomUUID().slice(0, 8);
const USUARIO_A = `hist-a-${SUFIJO}`;
const USUARIO_B = `hist-b-${SUFIJO}`;
const creadas: string[] = [];
const propuestas: string[] = [];

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function crear(
  sql: ReturnType<typeof crearCliente>["sql"],
  usuario: string,
  textoUsuario: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  creadas.push(id);
  await asegurarConversacion(sql, id, usuario);
  if (textoUsuario !== null) {
    await guardarMensaje(sql, id, "user", {
      parts: [{ type: "text", text: textoUsuario }],
    });
    await guardarMensaje(sql, id, "assistant", {
      parts: [{ type: "text", text: "respuesta" }],
    });
  }
  return id;
}

describe("historial de conversaciones", () => {
  afterAll(async () => {
    const cliente = crearCliente();
    try {
      for (const id of propuestas) {
        await cliente.sql`DELETE FROM propuestas WHERE id = ${id}::uuid`;
      }
      for (const id of creadas) {
        await cliente.sql`DELETE FROM mensajes WHERE conversacion_id = ${id}::uuid`;
        await cliente.sql`DELETE FROM conversaciones WHERE id = ${id}::uuid`;
      }
    } catch {
      // Sin base no hay nada que limpiar.
    } finally {
      await cliente.cerrar();
    }
  });

  it("las rutas validan usuario y UUID antes de tocar la base", async () => {
    expect(
      (await listar(new Request("http://localhost/api/conversaciones"))).status,
    ).toBe(400);
    expect(
      (
        await listar(
          new Request(`http://localhost/api/conversaciones?usuario=${"x".repeat(81)}`),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await borrar(
          new Request("http://localhost/api/conversaciones/no-es-uuid?usuario=a", {
            method: "DELETE",
          }),
          contexto("no-es-uuid"),
        )
      ).status,
    ).toBe(400);
    const id = crypto.randomUUID();
    expect(
      (
        await borrar(
          new Request(`http://localhost/api/conversaciones/${id}`, {
            method: "DELETE",
          }),
          contexto(id),
        )
      ).status,
    ).toBe(400);
  });

  it.skipIf(!bdActiva)(
    "lista solo las del usuario, con título recortado y por actividad",
    async () => {
      const cliente = crearCliente();
      try {
        const larga = "a".repeat(100);
        const primera = await crear(cliente.sql, USUARIO_A, larga);
        const segunda = await crear(cliente.sql, USUARIO_A, "  ¿Quién  cubre\nla noche? ");
        await crear(cliente.sql, USUARIO_A, null);
        const ajena = await crear(cliente.sql, USUARIO_B, "mensaje de B");

        const filas = await listarConversaciones(cliente.sql, USUARIO_A);
        expect(filas.map((fila) => fila.id)).toEqual([segunda, primera]);
        expect(filas[0]?.titulo).toBe("¿Quién cubre la noche?");
        expect(filas[1]?.titulo).toHaveLength(60);
        expect(filas.some((fila) => fila.id === ajena)).toBe(false);

        const respuesta = await listar(
          new Request(`http://localhost/api/conversaciones?usuario=${USUARIO_A}`),
        );
        expect(respuesta.status).toBe(200);
        const cuerpo = (await respuesta.json()) as {
          conversaciones: { id: string; titulo: string; ultima_actividad: string }[];
        };
        expect(cuerpo.conversaciones.map((fila) => fila.id)).toEqual([
          segunda,
          primera,
        ]);
        expect(Number.isNaN(Date.parse(cuerpo.conversaciones[0]!.ultima_actividad))).toBe(false);

        const deB = await listarConversaciones(cliente.sql, USUARIO_B);
        expect(deB.map((fila) => fila.id)).toEqual([ajena]);
      } finally {
        await cliente.cerrar();
      }
    },
  );

  it.skipIf(!bdActiva)(
    "solo el dueño elimina; otro usuario recibe 404 y no pierde nada",
    async () => {
      const cliente = crearCliente();
      try {
        const id = await crear(cliente.sql, USUARIO_A, "mía");

        const ajeno = await borrar(
          new Request(`http://localhost/api/conversaciones/${id}?usuario=${USUARIO_B}`, {
            method: "DELETE",
          }),
          contexto(id),
        );
        expect(ajeno.status).toBe(404);
        expect(await eliminarConversacion(cliente.sql, id, USUARIO_B)).toBe(
          "no_encontrada",
        );
        expect(
          (await listarConversaciones(cliente.sql, USUARIO_A)).map((f) => f.id),
        ).toContain(id);

        const propio = await borrar(
          new Request(`http://localhost/api/conversaciones/${id}?usuario=${USUARIO_A}`, {
            method: "DELETE",
          }),
          contexto(id),
        );
        expect(propio.status).toBe(200);
        const quedan = await cliente.sql<{ n: number }[]>`
          SELECT (
            (SELECT count(*) FROM mensajes WHERE conversacion_id = ${id}::uuid) +
            (SELECT count(*) FROM conversaciones WHERE id = ${id}::uuid)
          )::int AS n
        `;
        expect(Number(quedan[0]?.n)).toBe(0);
      } finally {
        await cliente.cerrar();
      }
    },
  );

  it.skipIf(!bdActiva)(
    "si una propuesta cuelga de la conversación, conserva la fila y la propuesta",
    async () => {
      const cliente = crearCliente();
      try {
        const id = await crear(cliente.sql, USUARIO_A, "con propuesta");
        const propuestaId = crypto.randomUUID();
        propuestas.push(propuestaId);
        await cliente.sql`
          INSERT INTO propuestas (id, conversacion_id, usuario, orden_texto, estado)
          VALUES (${propuestaId}::uuid, ${id}::uuid, ${USUARIO_A}, ${`historial-test:${id}`}, 'pendiente')
        `;

        expect(await eliminarConversacion(cliente.sql, id, USUARIO_A)).toBe(
          "conservada",
        );
        const estado = await cliente.sql<{ conv: number; prop: number; msgs: number }[]>`
          SELECT
            (SELECT count(*) FROM conversaciones WHERE id = ${id}::uuid)::int AS conv,
            (SELECT count(*) FROM propuestas WHERE id = ${propuestaId}::uuid)::int AS prop,
            (SELECT count(*) FROM mensajes WHERE conversacion_id = ${id}::uuid)::int AS msgs
        `;
        expect(estado[0]).toEqual({ conv: 1, prop: 1, msgs: 0 });
        expect(
          (await listarConversaciones(cliente.sql, USUARIO_A)).map((f) => f.id),
        ).not.toContain(id);
      } finally {
        await cliente.cerrar();
      }
    },
  );
});
