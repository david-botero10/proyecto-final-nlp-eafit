import Pagina from "@/app/page";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("página de chat", () => {
  it("renderiza la marca, la bienvenida y las cuatro sugerencias", () => {
    render(<Pagina />);

    expect(screen.getByText("Relevo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Coordinadora de enfermería/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva conversación" }),
    ).toBeInTheDocument();
    const sugerencias = screen.getByRole("list", { name: "Sugerencias" });
    expect(sugerencias.querySelectorAll("li")).toHaveLength(4);
    expect(
      screen.getByText(
        "Relevo consulta por su cuenta; nada se escribe en la nómina sin tu aprobación.",
      ),
    ).toBeInTheDocument();
  });
});
