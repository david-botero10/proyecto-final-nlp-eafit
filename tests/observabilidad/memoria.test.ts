/** @vitest-environment node */
import { afterAll, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/chat/route";
import { crearCliente, type Sql } from "@/lib/db/cliente";
import { mensajesDelTurno } from "@/lib/memoria/conversaciones";
import { vincularPropuesta } from "@/lib/memoria/conversaciones";

const clavePrevia = process.env.XAI_API_KEY;
delete process.env.XAI_API_KEY;

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

async function limpiar(sql: Sql, conversacionId: string): Promise<void> {
  await sql`
    DELETE FROM mensajes WHERE conversacion_id = ${conversacionId}::uuid
  `;
  await sql`
    DELETE FROM propuestas
    WHERE conversacion_id = ${conversacionId}::uuid
       OR orden_texto = ${`e1-test:${conversacionId}`}
  `;
  await sql`
    DELETE FROM conversaciones WHERE id = ${conversacionId}::uuid
  `;
}

describe("memoria de conversación", () => {
  afterAll(() => {
    if (clavePrevia === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = clavePrevia;
    }
  });

  it("si el cliente manda menos, el turno usa el historial guardado", () => {
    const historial = [
      { role: "user" as const, parts: [{ type: "text", text: "hola" }] },
      { role: "assistant" as const, parts: [{ type: "text", text: "buenas" }] },
    ];
    const cliente = [
      { role: "user" as const, parts: [{ type: "text", text: "¿y mañana?" }] },
    ];
    const combinado = mensajesDelTurno(cliente, historial);
    expect(combinado.map((mensaje) => mensaje.parts[0]?.text)).toEqual([
      "hola",
      "buenas",
      "¿y mañana?",
    ]);
    expect(mensajesDelTurno([...historial, ...cliente], historial)).toHaveLength(
      3,
    );
  });

  it.skipIf(!bdActiva)(
    "persiste el turno y lo recupera; enlaza la propuesta",
    async () => {
      const conversacionId = crypto.randomUUID();
      const propuestaId = crypto.randomUUID();
      const cliente = crearCliente();
      try {
        const respuesta = await POST(
          new Request("http://localhost/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversacion_id: conversacionId,
              usuario: "gerencia",
              messages: [
                {
                  role: "user",
                  parts: [{ type: "text", text: "hola memoria e1" }],
                },
              ],
            }),
          }),
        );
        expect(respuesta.status).toBe(200);
        await respuesta.text();

        await cliente.sql`
          INSERT INTO propuestas (id, usuario, orden_texto, estado)
          VALUES (
            ${propuestaId}::uuid,
            'e1-test',
            ${`e1-test:${conversacionId}`},
            'pendiente'
          )
        `;
        await vincularPropuesta(cliente.sql, propuestaId, conversacionId);
        const enlace = await cliente.sql<{ conversacion_id: string }[]>`
          SELECT conversacion_id::text AS conversacion_id
          FROM propuestas
          WHERE id = ${propuestaId}::uuid
        `;
        expect(enlace[0]?.conversacion_id).toBe(conversacionId);

        const lectura = await GET(
          new Request(
            `http://localhost/api/chat?conversacion_id=${conversacionId}&usuario=gerencia`,
          ),
        );
        expect(lectura.status).toBe(200);
        const cuerpo = (await lectura.json()) as {
          mensajes: { rol: string; parts: { type: string; text?: string }[] }[];
        };
        expect(cuerpo.mensajes.map((mensaje) => mensaje.rol)).toEqual([
          "user",
          "assistant",
        ]);
        expect(cuerpo.mensajes[0]?.parts[0]?.text).toBe("hola memoria e1");
        expect(cuerpo.mensajes[1]?.parts[0]?.text).toContain("Soy Relevo");

        const segunda = await POST(
          new Request("http://localhost/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversacion_id: conversacionId,
              usuario: "gerencia",
              messages: [
                {
                  role: "user",
                  parts: [{ type: "text", text: "¿sigues ahí?" }],
                },
              ],
            }),
          }),
        );
        expect(segunda.status).toBe(200);
        await segunda.text();
        const luego = await cliente.sql<{ n: number }[]>`
          SELECT count(*)::int AS n
          FROM mensajes
          WHERE conversacion_id = ${conversacionId}::uuid
        `;
        expect(Number(luego[0]?.n)).toBe(4);
      } finally {
        await limpiar(cliente.sql, conversacionId);
        await cliente.cerrar();
      }
    },
  );
});
