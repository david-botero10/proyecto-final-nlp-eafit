/** @vitest-environment node */
import { afterAll, describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/perfil/route";
import { crearCliente } from "@/lib/db/cliente";
import type { Perfil } from "@/lib/memoria/tipos";

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

function peticion(usuario: string, cuerpo?: unknown, metodo = "GET"): Request {
  return new Request(`http://localhost/api/perfil?usuario=${usuario}`, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
}

describe("perfiles", () => {
  const restaurar: Perfil[] = [];

  afterAll(async () => {
    if (!bdActiva || restaurar.length === 0) {
      return;
    }
    for (const perfil of restaurar) {
      await PUT(
        peticion(
          perfil.usuario,
          {
            rol: perfil.rol,
            equipo: perfil.equipo ?? "todos",
            preferencias: perfil.preferencias,
          },
          "PUT",
        ),
      );
    }
  });

  it.skipIf(!bdActiva)("siembra los tres perfiles y acepta un PUT", async () => {
    const esperados = [
      ["coordinadora_enfermeria", "coordinador", "enfermeria"],
      ["jefe_vigilancia", "coordinador", "vigilancia"],
      ["gerencia", "gerente", "todos"],
    ] as const;

    for (const [usuario, rol, equipo] of esperados) {
      const respuesta = await GET(peticion(usuario));
      expect(respuesta.status).toBe(200);
      const perfil = (await respuesta.json()) as Perfil;
      expect(perfil.rol).toBe(rol);
      expect(perfil.equipo).toBe(equipo);
      if (usuario === "gerencia") {
        restaurar.push(perfil);
      }
    }

    const puesto = await PUT(
      peticion(
        "gerencia",
        { rol: "gerente", equipo: "todos", preferencias: { marca: "e1" } },
        "PUT",
      ),
    );
    expect(puesto.status).toBe(200);
    const otra = await GET(peticion("gerencia"));
    const cuerpo = (await otra.json()) as Perfil;
    expect(cuerpo.preferencias).toEqual({ marca: "e1" });
  });
});
