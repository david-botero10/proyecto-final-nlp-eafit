/** @vitest-environment node */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GET as tarjeta } from "@/app/.well-known/agent.json/route";
import { POST as a2a } from "@/app/a2a/route";
import { cerrarClientesAuditor } from "@/auditor/mcp";
import { iniciarAuditor } from "@/auditor/servidor";
import {
  auditarPropuesta,
  olvidarCacheAuditor,
  solicitudDesdePropuesta,
} from "@/lib/a2a/cliente";
import { agentCardSchema } from "@/lib/a2a/esquemas";
import { propuestaTurno } from "../auditor/ayuda";

const ORIGEN = "https://relevo.example.com";
const previoToken = process.env.AUDITOR_TOKEN;
const previoPublica = process.env.AUDITOR_PUBLIC_URL;
const previoEmbed = process.env.EMBED_SERVICE_URL;

beforeAll(() => {
  // Sin servicio de embeddings: el auditor cae a su camino léxico, como en
  // tests/auditor/escenarios.test.ts.
  process.env.EMBED_SERVICE_URL = "http://127.0.0.1:9";
});

afterAll(() => {
  restaurar("EMBED_SERVICE_URL", previoEmbed);
});

afterEach(async () => {
  restaurar("AUDITOR_TOKEN", previoToken);
  restaurar("AUDITOR_PUBLIC_URL", previoPublica);
  await cerrarClientesAuditor();
});

function restaurar(clave: string, valor: string | undefined): void {
  if (valor === undefined) {
    delete process.env[clave];
  } else {
    process.env[clave] = valor;
  }
}

function cuerpoLimpio(id: string) {
  return {
    jsonrpc: "2.0",
    id,
    method: "message/send",
    params: {
      message: {
        role: "user",
        parts: [
          {
            kind: "data",
            data: solicitudDesdePropuesta(
              propuestaTurno({
                id: "p-limpia",
                turno: "M",
                fecha: "2026-09-28",
                orden: "Ponle la mañana el lunes 28 de septiembre.",
              }),
            ),
          },
        ],
      },
    },
  };
}

function enviar(cuerpo: unknown, token?: string): Request {
  return new Request(`${ORIGEN}/a2a`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-auditor-token": token } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
}

describe("GET /.well-known/agent.json", () => {
  it("publica la tarjeta con la URL del origen de la petición", async () => {
    const respuesta = await tarjeta(
      new Request(`${ORIGEN}/.well-known/agent.json`),
    );
    expect(respuesta.status).toBe(200);
    const datos = agentCardSchema.parse(await respuesta.json());
    expect(datos.name).toBe("Relevo Auditor");
    expect(datos.url).toBe(ORIGEN);
    expect(datos.skills[0]?.id).toBe("auditar_propuesta");
  });

  it("AUDITOR_PUBLIC_URL manda sobre el origen", async () => {
    process.env.AUDITOR_PUBLIC_URL = "https://publica.example.com/";
    const respuesta = await tarjeta(
      new Request("http://interno:3000/.well-known/agent.json"),
    );
    expect(agentCardSchema.parse(await respuesta.json()).url).toBe(
      "https://publica.example.com",
    );
  });

  it("con AUDITOR_TOKEN exige la cabecera", async () => {
    process.env.AUDITOR_TOKEN = "secreto-prueba";
    const sin = await tarjeta(new Request(`${ORIGEN}/.well-known/agent.json`));
    expect(sin.status).toBe(401);
    const con = await tarjeta(
      new Request(`${ORIGEN}/.well-known/agent.json`, {
        headers: { "x-auditor-token": "secreto-prueba" },
      }),
    );
    expect(con.status).toBe(200);
  });
});

describe("POST /a2a", () => {
  it("método desconocido: -32601, mismo contrato que el servidor Node", async () => {
    const respuesta = await a2a(
      enviar({ jsonrpc: "2.0", id: 7, method: "inventado", params: {} }),
    );
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32601, message: "Método no encontrado." },
    });
  });

  it("con AUDITOR_TOKEN: 401 sin token o con token ajeno", async () => {
    process.env.AUDITOR_TOKEN = "secreto-prueba";
    expect((await a2a(enviar(cuerpoLimpio("a")))).status).toBe(401);
    expect((await a2a(enviar(cuerpoLimpio("a"), "otro"))).status).toBe(401);
  });

  it("con AUDITOR_TOKEN y token correcto: veredicto aprobado", async () => {
    process.env.AUDITOR_TOKEN = "secreto-prueba";
    const respuesta = await a2a(enviar(cuerpoLimpio("ok-1"), "secreto-prueba"));
    expect(respuesta.status).toBe(200);
    const json = (await respuesta.json()) as {
      id: string;
      result: { artifacts: { parts: { data: { veredicto: string } }[] }[] };
    };
    expect(json.id).toBe("ok-1");
    // Mismo veredicto que «propuesta limpia → aprobado» en escenarios.test.ts.
    expect(json.result.artifacts[0].parts[0].data.veredicto).toBe("aprobado");
  });

  it("sin AUDITOR_TOKEN no se exige nada (local)", async () => {
    delete process.env.AUDITOR_TOKEN;
    const respuesta = await a2a(enviar(cuerpoLimpio("ok-2")));
    expect(respuesta.status).toBe(200);
  });
});

describe("cliente A2A con AUDITOR_TOKEN", () => {
  it("envía el token en la tarjeta y en message/send", async () => {
    process.env.AUDITOR_TOKEN = "secreto-prueba";
    const auditor = await iniciarAuditor({ puerto: 0 });
    const urlPrevia = process.env.AUDITOR_URL;
    process.env.AUDITOR_URL = auditor.url;
    olvidarCacheAuditor();
    try {
      const veredicto = await auditarPropuesta(
        propuestaTurno({
          id: "p-token",
          turno: "M",
          fecha: "2026-09-28",
          orden: "Ponle la mañana el lunes 28 de septiembre.",
        }),
      );
      expect(veredicto?.veredicto).toBe("aprobado");
    } finally {
      restaurar("AUDITOR_URL", urlPrevia);
      olvidarCacheAuditor();
      await auditor.cerrar();
    }
  });
});
