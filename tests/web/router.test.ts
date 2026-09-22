import { systemRelevo } from "@/lib/agente/prompt";
import { clasificarIntencion } from "@/lib/agente/router";
import { describe, expect, it } from "vitest";

describe("router de intención", () => {
  it("clasifica con un modelo mock y valida el contrato", async () => {
    const llamadas: string[] = [];
    const clasificacion = await clasificarIntencion(
      "¿Cuánto es el recargo nocturno?",
      {
        generar: async ({ prompt, system }) => {
          llamadas.push(prompt);
          expect(system).toContain("consulta_norma");
          expect(system).toContain("orden_escritura");
          return {
            intencion: "consulta_norma",
            confianza: 0.86,
            razon: "Pregunta por un recargo de la norma laboral.",
          };
        },
      },
    );

    expect(llamadas).toEqual(["¿Cuánto es el recargo nocturno?"]);
    expect(clasificacion.intencion).toBe("consulta_norma");
    expect(clasificacion.confianza).toBe(0.86);
  });

  it("rechaza una clasificación que no cumple el esquema", async () => {
    await expect(
      clasificarIntencion("hola", {
        generar: async () => ({
          intencion: "otra",
          confianza: 2,
          razon: "",
        }),
      }),
    ).rejects.toThrow();
  });

  it("sin clave no llama al modelo", async () => {
    const previa = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      await expect(clasificarIntencion("hola")).rejects.toThrow(/XAI_API_KEY/);
    } finally {
      if (previa === undefined) {
        delete process.env.XAI_API_KEY;
      } else {
        process.env.XAI_API_KEY = previa;
      }
    }
  });
});

describe("system prompt", () => {
  it("inyecta la fecha, la guía del router y la cita [1]", () => {
    const texto = systemRelevo("lunes, 21 de septiembre de 2026", {
      intencion: "orden_escritura",
      confianza: 0.9,
      razon: "Pide cambiar un turno.",
    });

    expect(texto).toContain("lunes, 21 de septiembre de 2026");
    expect(texto).toContain("orden_escritura");
    expect(texto).toContain("Pide cambiar un turno.");
    expect(texto).toContain("[1]");
    expect(texto).toContain("te propongo");
    expect(texto).toContain("revisa la tarjeta");
    expect(texto).not.toContain("no está disponible");
  });
});
