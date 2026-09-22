/** @vitest-environment node */
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { procesarOrdenEscritura } from "@/lib/agente/flujo-escritura";
import { responderConAsistente } from "@/lib/agente/asistente";
import {
  aplicarAlcance,
  filtrarResultado,
  type PerfilAlcance,
} from "@/lib/guardrails/alcance";
import { evaluarCitas, NOTA_CITAS } from "@/lib/guardrails/citas";
import { LIMITE_CARACTERES, reiniciarCupos } from "@/lib/guardrails/entrada";
import { afirmarSinEscrituraDirecta } from "@/lib/guardrails/escritura";
import type { Extraccion } from "@/lib/tipos";

const clavePrevia = process.env.XAI_API_KEY;
delete process.env.XAI_API_KEY;

const ENFERMERIA: PerfilAlcance = {
  usuario: "coordinadora_enfermeria",
  rol: "coordinador",
  equipo: "enfermeria",
};

const GERENCIA: PerfilAlcance = {
  usuario: "gerencia",
  rol: "gerente",
  equipo: "todos",
};

const EXTRACCION: Extraccion = {
  empleado: "Ana",
  turno: "M",
  fechas: ["2026-09-28"],
  justificacion: null,
  accion: "asignar",
  proveedor: "xai",
};

function peticion(cuerpo: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

function mensaje(texto: string, usuario = "e1-guardia") {
  return {
    usuario,
    messages: [{ role: "user", parts: [{ type: "text", text: texto }] }],
  };
}

describe("guardrails", () => {
  afterEach(() => {
    reiniciarCupos();
  });

  afterAll(() => {
    if (clavePrevia === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = clavePrevia;
    }
  });

  it("el arranque rechaza una tool de escritura de nómina", () => {
    expect(() => afirmarSinEscrituraDirecta()).not.toThrow();
    expect(() => afirmarSinEscrituraDirecta(["ejecutar_propuesta"])).toThrow(
      /nómina/,
    );
  });

  it("un coordinador solo lista su equipo y no ve otros turnos", async () => {
    const listar = await aplicarAlcance(
      "listar_empleados",
      { activo: true, equipo: "vigilancia" },
      ENFERMERIA,
      async () => ({ empleados: [] }),
    );
    expect(listar).toMatchObject({ args: { equipo: "enfermeria", activo: true } });

    const fuera = await aplicarAlcance(
      "consultar_turnos",
      { empleado: 99, desde: "2026-09-01", hasta: "2026-09-07" },
      ENFERMERIA,
      async (nombre) => {
        if (nombre === "listar_empleados") {
          return { empleados: [{ id: 24, nombre: "Ana Mery Montoya Patiño" }] };
        }
        return { asignaciones: [] };
      },
    );
    expect(fuera).toEqual({
      error: expect.stringMatching(/enfermeria/),
    });

    const dentro = await aplicarAlcance(
      "consultar_turnos",
      { desde: "2026-09-01", hasta: "2026-09-07" },
      ENFERMERIA,
      async () => ({
        empleados: [{ id: 24, nombre: "Ana Mery Montoya Patiño" }],
      }),
    );
    if ("error" in dentro) {
      throw new Error(dentro.error);
    }
    const filtrado = filtrarResultado(
      "consultar_turnos",
      {
        asignaciones: [
          { empleado: "Ana Mery Montoya Patiño", turno: "M" },
          { empleado: "Pedro Vigilancia", turno: "N" },
        ],
      },
      dentro.roster,
    ) as { asignaciones: { empleado: string }[] };
    expect(filtrado.asignaciones.map((fila) => fila.empleado)).toEqual([
      "Ana Mery Montoya Patiño",
    ]);
  });

  it("gerencia no recorta las consultas", async () => {
    const listar = await aplicarAlcance(
      "listar_empleados",
      { activo: true },
      GERENCIA,
      async () => ({ empleados: [] }),
    );
    expect(listar).toMatchObject({
      args: { activo: true },
      roster: null,
    });
  });

  it("rechaza una propuesta fuera del equipo", async () => {
    let creo = false;
    const resultado = await procesarOrdenEscritura("ponle la mañana a Ana", {
      hoy: "2026-09-21",
      perfil: ENFERMERIA,
      extraer: async () => ({ ...EXTRACCION, empleado: "Pedro" }),
      leerEmpleados: async () => [
        { id: 7, nombre: "Pedro Vigilancia", equipo: "vigilancia" },
      ],
      crear: async () => {
        creo = true;
        throw new Error("no debe crear");
      },
    });
    expect(creo).toBe(false);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.texto).toMatch(/vigilancia/);
      expect(resultado.texto).toMatch(/enfermeria/);
    }
  });

  it("anexa la nota si la norma no se cita ni se busca", async () => {
    expect(evaluarCitas("consulta_norma", "son 44 horas", false).anexar).toBe(
      true,
    );
    expect(evaluarCitas("consulta_norma", "son 44 horas [1]", false).anexar).toBe(
      false,
    );
    expect(evaluarCitas("consulta_norma", "son 44 horas", true).anexar).toBe(
      false,
    );
    expect(evaluarCitas("charla", "hola", false).anexar).toBe(false);

    const respuesta = await responderConAsistente(
      {
        messages: [
          { role: "user", parts: [{ type: "text", text: "¿y el dominical?" }] },
        ],
      },
      "¿y el dominical?",
      {
        clasificar: async () => ({
          intencion: "consulta_norma",
          confianza: 0.8,
          razon: "Pregunta por la norma.",
        }),
        completarTexto: async () => "El dominical se paga con recargo.",
      },
    );
    const texto = await respuesta.text();
    expect(texto).toContain(NOTA_CITAS);
  });

  it("rechaza vacío y más de 2000 caracteres", async () => {
    const vacio = await POST(
      peticion({
        messages: [{ role: "user", parts: [{ type: "text", text: "   " }] }],
      }),
    );
    expect(vacio.status).toBe(400);

    const largo = await POST(
      peticion(mensaje("a".repeat(LIMITE_CARACTERES + 1), "e1-largo")),
    );
    expect(largo.status).toBe(400);
    const cuerpo = (await largo.json()) as { error: string };
    expect(cuerpo.error).toMatch(/2000/);
  });

  it("responde 429 al pasar de 30 peticiones por minuto", async () => {
    for (let i = 0; i < 30; i += 1) {
      const respuesta = await POST(
        peticion({
          messages: [
            { role: "user", parts: [{ type: "text", text: `hola ${i}` }] },
          ],
        }),
      );
      expect(respuesta.status).toBe(200);
      await respuesta.text();
    }
    const extra = await POST(
      peticion({
        messages: [{ role: "user", parts: [{ type: "text", text: "una más" }] }],
      }),
    );
    expect(extra.status).toBe(429);
  });
});
