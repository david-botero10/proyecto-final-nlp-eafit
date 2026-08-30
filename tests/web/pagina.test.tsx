import Pagina from "@/app/page";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("página de chat", () => {
  it("renderiza el encabezado Relevo", () => {
    render(<Pagina />);

    expect(
      screen.getByRole("heading", { name: "Relevo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Asistente de turnos y ausencias"),
    ).toBeInTheDocument();
  });
});
