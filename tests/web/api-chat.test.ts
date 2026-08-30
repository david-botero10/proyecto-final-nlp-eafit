import { POST } from "@/app/api/chat/route";
import { describe, expect, it } from "vitest";

function peticion(cuerpo: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

describe("/api/chat", () => {
  it("responde stream con el texto esperado", async () => {
    const respuesta = await POST(
      peticion({
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "hola" }],
          },
        ],
      }),
    );

    expect(respuesta.status).toBe(200);
    const texto = await respuesta.text();
    expect(texto).toContain("Soy Relevo");
    expect(texto).toContain(
      "Aún no tengo modelo conectado (llega en la semana 3)",
    );
    expect(texto).toContain("Me preguntaste:");
    expect(texto).toContain("hola");
  });

  it("responde 400 con body inválido", async () => {
    const respuesta = await POST(peticion({ foo: 1 }));
    expect(respuesta.status).toBe(400);
  });
});
