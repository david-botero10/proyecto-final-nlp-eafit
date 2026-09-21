import { POST } from "@/app/api/chat/route";
import { afterAll, describe, expect, it } from "vitest";

const clavePrevia = process.env.XAI_API_KEY;
delete process.env.XAI_API_KEY;

function peticion(cuerpo: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

describe("/api/chat", () => {
  afterAll(() => {
    if (clavePrevia === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = clavePrevia;
    }
  });

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
    expect(texto).toContain("configura XAI_API_KEY");
  });

  it("sin XAI_API_KEY mantiene el stream simulado con la nota", async () => {
    delete process.env.XAI_API_KEY;
    const respuesta = await POST(
      peticion({
        messages: [
          {
            id: "m2",
            role: "user",
            parts: [{ type: "text", text: "¿cuánto es el recargo nocturno?" }],
          },
        ],
      }),
    );

    expect(respuesta.status).toBe(200);
    const texto = await respuesta.text();
    expect(texto).toContain("configura XAI_API_KEY");
    expect(texto).toContain("Soy Relevo");
    expect(texto).not.toContain("sk-");
  });

  it("responde 400 con body inválido", async () => {
    const respuesta = await POST(peticion({ foo: 1 }));
    expect(respuesta.status).toBe(400);
  });
});
