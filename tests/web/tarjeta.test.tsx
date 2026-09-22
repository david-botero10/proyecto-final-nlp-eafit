import { TarjetaPropuesta } from "@/components/tarjeta-propuesta";
import type { Propuesta } from "@/lib/tipos";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const PROPUESTA: Propuesta = {
  propuesta_id: "11111111-1111-4111-8111-111111111111",
  estado: "pendiente",
  usuario: "coordinador",
  orden_texto: "ponle la mañana a Ana el lunes",
  extraccion: {
    empleado: "Ana",
    turno: "M",
    fechas: ["2026-09-28"],
    justificacion: null,
    accion: "asignar",
    proveedor: "xai",
  },
  acciones: [
    {
      tipo: "asignar_turno",
      empleado_id: 24,
      turno: "M",
      fecha: "2026-09-28",
    },
  ],
  contexto: {
    solapes_detectados: [
      {
        empleado_id: 24,
        empleado: "Ana Mery Montoya Patiño",
        fecha: "2026-09-22",
        turno: "T",
        estado: "programada",
      },
    ],
    ausencias_en_rango: [],
  },
  veredicto_auditor: null,
  nombres: [{ id: 24, nombre: "Ana Mery Montoya Patiño" }],
};

function resumenAprobado() {
  return {
    propuesta_id: PROPUESTA.propuesta_id,
    decision: "aprobar",
    estado: "aprobada",
    filas: { asignaciones: 1, ausencias: 0, cancelaciones: 0 },
  };
}

describe("tarjeta de propuesta", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("muestra la orden, la acción, el solape y sin auditar", () => {
    render(<TarjetaPropuesta propuesta={PROPUESTA} />);
    expect(screen.getByText(PROPUESTA.orden_texto)).toBeInTheDocument();
    expect(screen.getAllByText(/Ana Mery Montoya Patiño/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026-09-28/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mañana").length).toBeGreaterThan(0);
    expect(screen.getByText(/Solape: Ana Mery/)).toBeInTheDocument();
    expect(screen.getByText("sin auditar")).toBeInTheDocument();
  });

  it("al aprobar llama al endpoint y muestra el resumen", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(resumenAprobado(), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const usuario = userEvent.setup();
    render(<TarjetaPropuesta propuesta={PROPUESTA} />);

    await usuario.click(screen.getByRole("button", { name: "Aprobar" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "/api/propuestas/11111111-1111-4111-8111-111111111111/decision",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      decision: "aprobar",
      usuario: "coordinador",
    });
    expect(await screen.findByText(/Quedó aprobada/)).toBeInTheDocument();
    expect(screen.getByText(/1 asignación/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Corregir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeDisabled();
  });

  it("corregir envía el turno editado", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/decision");
      expect(init?.method).toBe("POST");
      return Response.json(
        {
          ...resumenAprobado(),
          decision: "corregir",
          estado: "corregida",
        },
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const usuario = userEvent.setup();
    render(<TarjetaPropuesta propuesta={PROPUESTA} />);

    await usuario.click(screen.getByRole("button", { name: "Corregir" }));
    await usuario.selectOptions(
      screen.getByLabelText("Turno de la fila 1"),
      "T",
    );
    await usuario.click(screen.getByRole("button", { name: "Enviar corrección" }));

    const cuerpo = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      decision: string;
      correccion: { turno: string; fecha: string }[];
    };
    expect(cuerpo.decision).toBe("corregir");
    expect(cuerpo.correccion).toEqual([
      {
        tipo: "asignar_turno",
        empleado_id: 24,
        turno: "T",
        fecha: "2026-09-28",
      },
    ]);
    expect(await screen.findByText(/Quedó corregida/)).toBeInTheDocument();
  });

  it("un veredicto rechazado bloquea aprobar", () => {
    render(
      <TarjetaPropuesta
        propuesta={{
          ...PROPUESTA,
          veredicto_auditor: {
            propuesta_id: PROPUESTA.propuesta_id,
            veredicto: "rechazado",
            razones: ["El empleado no existe"],
            normas_citadas: [],
            verificaciones: {
              empleado_existe: false,
              sin_solapes: true,
              jornada_dentro_de_limites: true,
            },
          },
        }}
      />,
    );
    expect(screen.getByText("rechazado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Corregir" })).toBeEnabled();
  });

  it("muestra el error del endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "La propuesta ya fue decidida (estado=aprobada)." },
          { status: 409 },
        ),
      ),
    );
    const usuario = userEvent.setup();
    render(<TarjetaPropuesta propuesta={PROPUESTA} />);
    await usuario.click(screen.getByRole("button", { name: "Aprobar" }));
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("La propuesta ya fue decidida");
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
  });
});
