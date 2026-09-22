/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentCardSchema } from "@/lib/a2a/esquemas";
import { iniciarAuditor, type AuditorEnMarcha } from "@/auditor/servidor";

describe("protocolo A2A del auditor", () => {
  let auditor: AuditorEnMarcha;

  beforeAll(async () => {
    auditor = await iniciarAuditor({ puerto: 0 });
  });

  afterAll(async () => {
    await auditor.cerrar();
  });

  async function post(cuerpo: unknown): Promise<{
    status: number;
    json: {
      jsonrpc?: string;
      id?: unknown;
      error?: { code?: number; message?: string };
    };
  }> {
    const respuesta = await fetch(`${auditor.url}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    });
    return {
      status: respuesta.status,
      json: (await respuesta.json()) as {
        jsonrpc?: string;
        id?: unknown;
        error?: { code?: number; message?: string };
      },
    };
  }

  it("publica la Agent Card y valida con Zod", async () => {
    const respuesta = await fetch(`${auditor.url}/.well-known/agent.json`);
    expect(respuesta.status).toBe(200);
    const tarjeta = agentCardSchema.parse(await respuesta.json());
    expect(tarjeta.name).toBe("Relevo Auditor");
    expect(tarjeta.capabilities).toEqual({ streaming: false });
    expect(tarjeta.url).toBe(auditor.url);
    expect(tarjeta.skills[0]?.id).toBe("auditar_propuesta");
    expect(tarjeta.skills[0]?.inputModes).toEqual(["application/json"]);
    expect(tarjeta.skills[0]?.outputModes).toEqual(["application/json"]);
  });

  it("rechaza un método desconocido con -32601", async () => {
    const { status, json } = await post({
      jsonrpc: "2.0",
      id: 7,
      method: "inventado",
      params: {},
    });
    expect(status).toBe(200);
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(7);
    expect(json.error).toEqual({
      code: -32601,
      message: "Método no encontrado.",
    });
  });

  it("rechaza parámetros inválidos con -32602", async () => {
    const { json } = await post({
      jsonrpc: "2.0",
      id: "params",
      method: "message/send",
      params: {},
    });
    expect(json.id).toBe("params");
    expect(json.error?.code).toBe(-32602);
    expect(json.error?.message).toMatch(/^Parámetros inválidos/);
  });

  it("rechaza una petición que no es JSON-RPC 2.0 con -32600", async () => {
    const { json } = await post({
      jsonrpc: "1.0",
      id: 1,
      method: "message/send",
    });
    expect(json.error?.code).toBe(-32600);
    expect(json.error?.message).toMatch(/no es válida/);
  });

  it("responde que la tarea no está persistida", async () => {
    const { json } = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tasks/get",
      params: { id: "tarea-inexistente" },
    });
    expect(json.error).toEqual({
      code: -32001,
      message: "La tarea no está persistida.",
    });
  });
});
