/** @vitest-environment node */
import { extraerOrden, systemExtractor } from "@/lib/agente/extraccion";
import { afterEach, describe, expect, it, vi } from "vitest";

const FECHA = "2026-09-21";

const MODELO = {
  empleado: "Ana",
  turno: "M",
  fechas: ["2026-09-28", "2026-09-29"],
  justificacion: null,
  accion: "asignar",
};

describe("extracción", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EXTRACTOR_URL;
  });

  it("el prompt resuelve fechas relativas colombianas", async () => {
    let system = "";
    const extraccion = await extraerOrden("ponle el de la mañana a Ana", FECHA, {
      urlExtractor: null,
      generar: async (entrada) => {
        system = entrada.system;
        expect(entrada.prompt).toContain("Ana");
        return MODELO;
      },
    });

    expect(system).toBe(systemExtractor(FECHA));
    expect(system).toContain(FECHA);
    expect(system).toContain("la otra semana");
    expect(system).toContain("el puente");
    expect(system).toContain("2026-04-02");
    expect(extraccion.proveedor).toBe("xai");
    expect(extraccion.empleado).toBe("Ana");
    expect(extraccion.fechas).toEqual(["2026-09-28", "2026-09-29"]);
  });

  it("usa el extractor afinado cuando responde", async () => {
    const generar = vi.fn();
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://extractor.local/extraer");
      expect(init?.method).toBe("POST");
      return Response.json({
        extraccion: {
          empleado: "Ana",
          turno: null,
          fechas: ["2026-09-28"],
          justificacion: "vacaciones",
          accion: "ausencia",
        },
      });
    });
    const extraccion = await extraerOrden("Ana sale de vacaciones", FECHA, {
      urlExtractor: "http://extractor.local/",
      fetcher,
      generar,
    });

    expect(generar).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(
      "http://extractor.local/extraer",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetcher.mock.calls[0]?.[1];
    if (!init?.body) {
      throw new Error("la llamada al extractor no trae cuerpo");
    }
    expect(JSON.parse(String(init.body))).toEqual({
      orden: "Ana sale de vacaciones",
      fecha_referencia: FECHA,
    });
    expect(extraccion.proveedor).toBe("lora");
    expect(extraccion.accion).toBe("ausencia");
    expect(extraccion.turno).toBeNull();
  });

  it("cae a Grok si el extractor afinado falla", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("caído");
    });
    const extraccion = await extraerOrden("ponle la noche", FECHA, {
      urlExtractor: "http://extractor.local",
      fetcher,
      generar: async () => ({ ...MODELO, turno: "N" }),
    });
    expect(extraccion.proveedor).toBe("xai");
    expect(extraccion.turno).toBe("N");
  });

  it("sin clave y sin extractor no llama a la red", async () => {
    const previa = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    vi.stubGlobal("fetch", vi.fn());
    try {
      await expect(extraerOrden("hola", FECHA, { urlExtractor: null })).rejects.toThrow(
        /modelo de extracción/,
      );
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      if (previa === undefined) {
        delete process.env.XAI_API_KEY;
      } else {
        process.env.XAI_API_KEY = previa;
      }
    }
  });
});
