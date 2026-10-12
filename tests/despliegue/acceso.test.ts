/** @vitest-environment node */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as acceder } from "@/app/api/acceso/route";
import { COOKIE_ACCESO, firmaDeAcceso } from "@/lib/acceso";
import { middleware } from "@/middleware";

const CODIGO = "prueba-123";
let previo: string | undefined;

function pedir(ruta: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${ruta}`, {
    headers: cookie ? { cookie: `${COOKIE_ACCESO}=${cookie}` } : {},
  });
}

beforeEach(() => {
  previo = process.env.ACCESS_CODE;
});

afterEach(() => {
  if (previo === undefined) {
    delete process.env.ACCESS_CODE;
  } else {
    process.env.ACCESS_CODE = previo;
  }
});

function pasa(respuesta: Response): boolean {
  return respuesta.headers.get("x-middleware-next") === "1";
}

describe("middleware de acceso", () => {
  it("sin ACCESS_CODE no hace nada", async () => {
    delete process.env.ACCESS_CODE;
    expect(pasa(await middleware(pedir("/")))).toBe(true);
    expect(pasa(await middleware(pedir("/api/chat")))).toBe(true);
  });

  it("con código y sin cookie: las páginas redirigen a /acceso", async () => {
    process.env.ACCESS_CODE = CODIGO;
    const respuesta = await middleware(pedir("/"));
    expect(respuesta.status).toBe(307);
    expect(new URL(respuesta.headers.get("location") ?? "").pathname).toBe(
      "/acceso",
    );
  });

  it("con código y sin cookie: el API responde 401 JSON", async () => {
    process.env.ACCESS_CODE = CODIGO;
    const respuesta = await middleware(pedir("/api/chat"));
    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toHaveProperty("error");
  });

  it("una cookie con el código en claro o ajena no vale", async () => {
    process.env.ACCESS_CODE = CODIGO;
    expect((await middleware(pedir("/", CODIGO))).status).toBe(307);
    expect((await middleware(pedir("/", "0".repeat(64)))).status).toBe(307);
  });

  it("con la cookie correcta pasa", async () => {
    process.env.ACCESS_CODE = CODIGO;
    const cookie = await firmaDeAcceso(CODIGO);
    expect(pasa(await middleware(pedir("/", cookie)))).toBe(true);
    expect(pasa(await middleware(pedir("/api/chat", cookie)))).toBe(true);
  });

  it("al rotar el código la cookie anterior deja de valer", async () => {
    process.env.ACCESS_CODE = "otro-codigo";
    const vieja = await firmaDeAcceso(CODIGO);
    expect((await middleware(pedir("/", vieja))).status).toBe(307);
  });

  it("las rutas exentas pasan sin cookie", async () => {
    process.env.ACCESS_CODE = CODIGO;
    for (const ruta of [
      "/acceso",
      "/api/acceso",
      "/.well-known/agent.json",
      "/a2a",
    ]) {
      expect(pasa(await middleware(pedir(ruta)))).toBe(true);
    }
  });
});

describe("POST /api/acceso", () => {
  function enviar(cuerpo: unknown): Request {
    return new Request("http://localhost:3000/api/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  }

  it("código incorrecto: 401 y sin cookie", async () => {
    process.env.ACCESS_CODE = CODIGO;
    const respuesta = await acceder(enviar({ codigo: "mal" }));
    expect(respuesta.status).toBe(401);
    expect(respuesta.headers.get("set-cookie")).toBeNull();
  });

  it("código correcto: cookie httpOnly, secure, lax, 7 días y firmada", async () => {
    process.env.ACCESS_CODE = CODIGO;
    const respuesta = await acceder(enviar({ codigo: CODIGO }));
    expect(respuesta.status).toBe(200);
    const cookie = respuesta.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_ACCESO}=${await firmaDeAcceso(CODIGO)}`);
    expect(cookie).not.toContain(CODIGO);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Max-Age=604800");
  });

  it("cuerpo que no es JSON: 400", async () => {
    process.env.ACCESS_CODE = CODIGO;
    const respuesta = await acceder(
      new Request("http://localhost:3000/api/acceso", {
        method: "POST",
        body: "no json",
      }),
    );
    expect(respuesta.status).toBe(400);
  });
});
