import { BarraLateral } from "@/components/shell/barra-lateral";
import {
  agruparHistorial,
  filtrarHistorial,
  type ConversacionResumen,
} from "@/lib/ui/agrupar-historial";
import { actividadDe } from "@/lib/ui/herramientas";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const AHORA = new Date(2026, 9, 12, 15, 0, 0);

function conversacion(
  id: string,
  titulo: string,
  diasAtras: number,
): ConversacionResumen {
  const fecha = new Date(AHORA);
  fecha.setDate(fecha.getDate() - diasAtras);
  return { id, titulo, ultima_actividad: fecha.toISOString() };
}

const LISTA = [
  conversacion("a", "Recargo nocturno", 0),
  conversacion("b", "Turnos del sábado", 1),
  conversacion("c", "Ausencias de la semana", 4),
  conversacion("d", "Orden de Elizabeth", 30),
];

describe("agrupar y filtrar el historial", () => {
  it("agrupa en Hoy, Ayer, Últimos 7 días y Anteriores", () => {
    const grupos = agruparHistorial(LISTA, AHORA);
    expect(grupos.map((grupo) => grupo.etiqueta)).toEqual([
      "Hoy",
      "Ayer",
      "Últimos 7 días",
      "Anteriores",
    ]);
    expect(grupos[2]?.conversaciones.map((fila) => fila.id)).toEqual(["c"]);
  });

  it("omite los grupos vacíos", () => {
    expect(
      agruparHistorial([conversacion("a", "x", 0)], AHORA).map(
        (grupo) => grupo.etiqueta,
      ),
    ).toEqual(["Hoy"]);
  });

  it("filtra sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarHistorial(LISTA, "SABADO").map((fila) => fila.id)).toEqual([
      "b",
    ]);
    expect(filtrarHistorial(LISTA, "  ")).toHaveLength(4);
  });
});

describe("actividad de herramientas", () => {
  it("etiqueta las herramientas conocidas y humaniza las demás", () => {
    expect(
      actividadDe({ type: "tool-listar_empleados", state: "output-available" })
        ?.etiqueta,
    ).toBe("Consultó empleados");
    expect(
      actividadDe({ type: "tool-consultar_turnos", state: "input-available" })
        ?.etiqueta,
    ).toBe("Consultando turnos");
    expect(
      actividadDe({ type: "tool-algo_nuevo", state: "input-available" })
        ?.etiqueta,
    ).toBe("Algo nuevo");
    expect(actividadDe({ type: "text" })).toBeNull();
  });

  it("resume el número de resultados", () => {
    const actividad = actividadDe({
      type: "tool-consultar_ausencias",
      state: "output-available",
      output: { ausencias: [{}, {}, {}] },
    });
    expect(actividad?.estado).toBe("listo");
    expect(actividad?.resultado).toBe("3 resultados");
  });
});

describe("barra lateral", () => {
  afterEach(() => {
    cleanup();
  });

  function montar(sobrescribir: Partial<Parameters<typeof BarraLateral>[0]> = {}) {
    const props = {
      cerrada: false,
      conversaciones: LISTA.slice(0, 2),
      cargando: false,
      activaId: "a",
      usuario: "gerencia",
      ocupado: false,
      enfocarBusqueda: 0,
      onCerrar: vi.fn(),
      onNueva: vi.fn(),
      onSeleccionar: vi.fn(),
      onEliminar: vi.fn(),
      onCambiarUsuario: vi.fn(),
      ...sobrescribir,
    };
    render(<BarraLateral {...props} />);
    return props;
  }

  it("selecciona una conversación y marca la activa", async () => {
    const usuario = userEvent.setup();
    const props = montar();
    const nav = screen.getByRole("navigation", {
      name: "Historial de conversaciones",
    });
    expect(
      within(nav).getByRole("button", { name: "Recargo nocturno" }),
    ).toHaveAttribute("aria-current", "true");
    await usuario.click(
      within(nav).getByRole("button", { name: "Turnos del sábado" }),
    );
    expect(props.onSeleccionar).toHaveBeenCalledWith("b");
  });

  it("pide confirmación antes de eliminar", async () => {
    const usuario = userEvent.setup();
    const props = montar();
    await usuario.click(
      screen.getByRole("button", { name: "Eliminar «Turnos del sábado»" }),
    );
    expect(props.onEliminar).not.toHaveBeenCalled();
    expect(screen.getByText("¿Eliminar?")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "No" }));
    expect(props.onEliminar).not.toHaveBeenCalled();

    await usuario.click(
      screen.getByRole("button", { name: "Eliminar «Turnos del sábado»" }),
    );
    await usuario.click(screen.getByRole("button", { name: "Sí" }));
    expect(props.onEliminar).toHaveBeenCalledWith("b");
  });

  it("filtra con el buscador y cambia de perfil desde la tarjeta", async () => {
    const usuario = userEvent.setup();
    const props = montar();
    await usuario.type(screen.getByRole("searchbox"), "sabado");
    expect(
      screen.queryByRole("button", { name: "Recargo nocturno" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Turnos del sábado" }),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /^Perfil:/ }));
    await usuario.click(
      screen.getByRole("menuitemradio", { name: /Jefe de vigilancia/ }),
    );
    expect(props.onCambiarUsuario).toHaveBeenCalledWith("jefe_vigilancia");
  });
});
