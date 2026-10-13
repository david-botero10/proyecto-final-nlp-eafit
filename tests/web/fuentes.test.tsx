import { MensajeAsistente } from "@/components/chat/mensaje-asistente";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

const FIXTURE = [
  {
    type: "data-intencion",
    data: {
      intencion: "consulta_norma",
      confianza: 0.9,
      razon: "Pregunta normativa.",
    },
  },
  {
    type: "tool-buscar_norma",
    state: "output-available",
    input: { consulta: "recargo nocturno" },
    output: {
      modo: "hibrida",
      resultados: [
        {
          chunk_id: 168,
          ref: "art. 168",
          fuente: "CST",
          titulo: "Código Sustantivo del Trabajo",
          url: "https://example.test/cst",
          fragmento: "El recargo nocturno es del treinta y cinco por ciento.",
          score: 0.2,
        },
        {
          chunk_id: 179,
          ref: "art. 179",
          fuente: "CST",
          titulo: "Descanso dominical",
          url: null,
          fragmento: "El descanso dominical es obligatorio.",
          score: 0.1,
        },
      ],
    },
  },
  {
    type: "text",
    text: "El recargo nocturno es del **35 %** [1].",
  },
];

describe("panel de fuentes", () => {
  afterEach(() => {
    cleanup();
  });

  it("renderiza fuentes numeradas, el enlace y el chip de intención", async () => {
    const usuario = userEvent.setup();
    render(<MensajeAsistente parts={FIXTURE} />);

    expect(screen.getByText("consulta de norma")).toBeInTheDocument();
    // El markdown se interpreta y el marcador [1] sigue visible.
    expect(screen.getByText("35 %").tagName).toBe("STRONG");
    expect(
      screen.getByRole("button", { name: "Ver fuente 1" }),
    ).toHaveTextContent("[1]");

    const fuentes = screen.getByRole("region", { name: "Fuentes" });
    const alternar = screen.getByRole("button", { name: "2 fuentes" });
    expect(alternar).toHaveAttribute("aria-expanded", "false");
    await usuario.click(alternar);
    expect(alternar).toHaveAttribute("aria-expanded", "true");

    const items = fuentes.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("CST");
    expect(items[0]).toHaveTextContent("art. 168");
    const enlace = screen.getByRole("link", {
      name: "Código Sustantivo del Trabajo",
    });
    expect(enlace).toHaveAttribute("href", "https://example.test/cst");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    expect(items[1]).toHaveTextContent("art. 179");
    expect(items[1]).toHaveTextContent("Descanso dominical");
    expect(
      screen.queryByRole("link", { name: "Descanso dominical" }),
    ).not.toBeInTheDocument();
  });

  it("el chip [1] abre las fuentes y resalta la fila", async () => {
    const usuario = userEvent.setup();
    render(<MensajeAsistente parts={FIXTURE} />);

    const alternar = screen.getByRole("button", { name: "2 fuentes" });
    expect(alternar).toHaveAttribute("aria-expanded", "false");
    await usuario.click(screen.getByRole("button", { name: "Ver fuente 1" }));
    expect(alternar).toHaveAttribute("aria-expanded", "true");
    const filas = screen
      .getByRole("region", { name: "Fuentes" })
      .querySelectorAll("li");
    expect(filas[0]?.className).toContain("bg-primary-tint");
    expect(filas[1]?.className).not.toContain("bg-primary-tint");
  });

  it("sin fuentes el marcador [1] queda como texto plano", () => {
    render(
      <MensajeAsistente parts={[{ type: "text", text: "Mira esto [1]." }]} />,
    );
    expect(screen.getByText("Mira esto [1].")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver fuente 1" }),
    ).not.toBeInTheDocument();
  });

  it("muestra el carril de actividad con la consulta de la norma", () => {
    render(<MensajeAsistente parts={FIXTURE} />);
    expect(
      screen.getByText("Buscó en la norma: «recargo nocturno»"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Listo")).toBeInTheDocument();
  });

  it("avisa cuando buscar_norma está en curso", () => {
    render(
      <MensajeAsistente
        parts={[
          {
            type: "tool-buscar_norma",
            state: "input-available",
            input: { consulta: "dominical" },
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Buscando en la norma: «dominical»"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("En curso")).toBeInTheDocument();
  });

  it("muestra el error de una herramienta que falló", () => {
    render(
      <MensajeAsistente
        parts={[
          {
            type: "tool-consultar_turnos",
            state: "output-error",
            errorText: "falló",
          },
        ]}
      />,
    );
    expect(screen.getByText("Consultó turnos")).toBeInTheDocument();
    expect(screen.getByLabelText("Falló")).toBeInTheDocument();
  });
});
