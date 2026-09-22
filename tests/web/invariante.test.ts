/** @vitest-environment node */
import { nombresHerramientas, responderConAsistente } from "@/lib/agente/asistente";
import type { Propuesta } from "@/lib/tipos";
import { describe, expect, it } from "vitest";

const PROPUESTA: Propuesta = {
  propuesta_id: "33333333-3333-4333-8333-333333333333",
  estado: "pendiente",
  usuario: "coordinador",
  orden_texto: "ponle la mañana a Ana",
  extraccion: {
    empleado: "Ana",
    turno: "M",
    fechas: ["2026-09-28"],
    justificacion: null,
    accion: "asignar",
    proveedor: "lora",
  },
  acciones: [
    {
      tipo: "asignar_turno",
      empleado_id: 24,
      turno: "M",
      fecha: "2026-09-28",
    },
  ],
  contexto: { solapes_detectados: [], ausencias_en_rango: [] },
  veredicto_auditor: null,
  nombres: [{ id: 24, nombre: "Ana Mery Montoya Patiño" }],
};

describe("invariante de escritura", () => {
  it("ejecutar_propuesta no está entre las tools del modelo", () => {
    const nombres = nombresHerramientas();
    expect(nombres).not.toContain("ejecutar_propuesta");
    expect(nombres).toContain("crear_propuesta");
    expect(nombres).toContain("listar_empleados");
    expect(nombres).toContain("consultar_turnos");
    expect(nombres).toContain("consultar_ausencias");
    expect(nombres).toContain("buscar_norma");
  });

  it("una orden emite la tarjeta y el texto de propuesta, sin red", async () => {
    const respuesta = await responderConAsistente(
      {
        messages: [
          {
            role: "user",
            parts: [{ type: "text", text: "ponle la mañana a Ana" }],
          },
        ],
      },
      "ponle la mañana a Ana",
      {
        clasificar: async () => ({
          intencion: "orden_escritura",
          confianza: 0.95,
          razon: "Pide asignar un turno.",
        }),
        procesarOrden: async () => ({
          ok: true,
          propuesta: PROPUESTA,
          texto:
            "Te propongo este cambio a partir de tu orden. Revisa la tarjeta: nada se escribe en la nómina hasta que apruebes, corrijas o rechaces.",
        }),
      },
    );

    expect(respuesta.status).toBe(200);
    const texto = await respuesta.text();
    expect(texto).toContain("data-propuesta");
    expect(texto).toContain(PROPUESTA.propuesta_id);
    expect(texto).toContain("Te propongo");
    expect(texto.toLowerCase()).toContain("revisa la tarjeta");
    expect(texto).not.toContain("ejecutar_propuesta");
  });
});
