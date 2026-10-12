import { Chat } from "@/components/chat/chat";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

function respuestaSimulada(): Response {
  const cuerpo = [
    `data: {"type":"start"}\n\n`,
    `data: {"type":"text-start","id":"t1"}\n\n`,
    `data: {"type":"text-delta","id":"t1","delta":"ok"}\n\n`,
    `data: {"type":"text-end","id":"t1"}\n\n`,
    `data: {"type":"finish"}\n\n`,
    `data: [DONE]\n\n`,
  ].join("");

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

describe("chat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("el input envía mensajes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuestaSimulada()),
    );
    const usuario = userEvent.setup();
    render(<Chat />);

    const input = screen.getByPlaceholderText("Escribe una orden o pregunta…");
    await usuario.type(input, "¿quién cubre el turno de la noche?");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    // El texto aparece en la burbuja y en el título de la barra superior.
    const apariciones = await screen.findAllByText(
      "¿quién cubre el turno de la noche?",
    );
    expect(apariciones.length).toBeGreaterThanOrEqual(1);
  });
});
