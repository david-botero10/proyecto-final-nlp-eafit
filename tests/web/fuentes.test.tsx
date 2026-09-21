import { MensajeAsistente } from "@/components/mensaje-asistente";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
    type: "text",
    text: "El recargo nocturno es del 35 % [1].",
  },
  {
    type: "tool-buscar_norma",
    state: "output-available",
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
];

describe("panel de fuentes", () => {
  it("renderiza fuentes numeradas, el enlace y el chip de intención", () => {
    render(<MensajeAsistente parts={FIXTURE} />);

    expect(screen.getByText("consulta de norma")).toBeInTheDocument();
    expect(
      screen.getByText("El recargo nocturno es del 35 % [1]."),
    ).toBeInTheDocument();

    const fuentes = screen.getByRole("region", { name: "Fuentes" });
    expect(fuentes).toBeInTheDocument();
    const items = fuentes.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("CST");
    expect(items[0]).toHaveTextContent("art. 168");
    expect(
      screen.getByRole("link", { name: "Código Sustantivo del Trabajo" }),
    ).toHaveAttribute("href", "https://example.test/cst");
    expect(items[1]).toHaveTextContent("art. 179");
    expect(items[1]).toHaveTextContent("Descanso dominical");
    expect(
      screen.queryByRole("link", { name: "Descanso dominical" }),
    ).not.toBeInTheDocument();
  });

  it("avisa cuando buscar_norma está en curso", () => {
    render(
      <MensajeAsistente
        parts={[
          {
            type: "tool-buscar_norma",
            state: "input-available",
          },
        ]}
      />,
    );

    expect(screen.getByText("consultando norma…")).toBeInTheDocument();
  });
});
