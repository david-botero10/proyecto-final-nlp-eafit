import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { construirAgentCard } from "./agent-card";
import {
  CABECERA_TOKEN,
  errorCuerpoNoValido,
  procesarJsonRpc,
  TOPE_CUERPO,
  tokenAuditorValido,
} from "./a2a";
import { cerrarClientesAuditor } from "./mcp";

const PUERTO_POR_DEFECTO = 8641;

function esEntradaPrincipal(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(argv1)).href;
}

function responder(res: ServerResponse, codigo: number, cuerpo: unknown): void {
  const json = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    let total = 0;
    req.on("data", (trozo: Buffer | string) => {
      const buffer = typeof trozo === "string" ? Buffer.from(trozo) : trozo;
      total += buffer.length;
      if (total > TOPE_CUERPO) {
        reject(new Error("grande"));
        req.destroy();
        return;
      }
      trozos.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(trozos).toString("utf8")));
    req.on("error", reject);
  });
}

function basePublica(req: IncomingMessage, puerto: number): string {
  const host = req.headers.host;
  if (
    typeof host === "string" &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  ) {
    return `http://${host}`;
  }
  return `http://127.0.0.1:${puerto}`;
}

function tokenDe(req: IncomingMessage): string | undefined {
  const valor = req.headers[CABECERA_TOKEN];
  return Array.isArray(valor) ? valor[0] : valor;
}

async function manejarA2a(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let texto: string;
  try {
    texto = await leerCuerpo(req);
  } catch {
    responder(res, 200, errorCuerpoNoValido());
    return;
  }
  responder(res, 200, await procesarJsonRpc(texto));
}

export type AuditorEnMarcha = {
  url: string;
  puerto: number;
  cerrar: () => Promise<void>;
};

/** Servidor HTTP del auditor. `puerto` 0 elige uno libre (tests). */
export function iniciarAuditor(opciones?: {
  puerto?: number;
}): Promise<AuditorEnMarcha> {
  const puertoPedido = opciones?.puerto ?? Number(process.env.AUDITOR_PORT ?? PUERTO_POR_DEFECTO);
  let puertoPublico = puertoPedido;
  const sockets = new Set<Socket>();
  const server = createServer((req, res) => {
    const url = req.url?.split("?")[0] ?? "/";
    const esCard = req.method === "GET" && url === "/.well-known/agent.json";
    const esA2a = url === "/a2a" && req.method === "POST";
    if ((esCard || esA2a) && !tokenAuditorValido(tokenDe(req))) {
      responder(res, 401, { error: "Token del auditor ausente o inválido." });
      return;
    }
    if (esCard) {
      responder(res, 200, construirAgentCard(basePublica(req, puertoPublico)));
      return;
    }
    if (esA2a) {
      void manejarA2a(req, res);
      return;
    }
    responder(res, 404, { error: "Ruta no encontrada." });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(puertoPedido, "127.0.0.1", () => {
      const direccion = server.address();
      puertoPublico =
        typeof direccion === "object" && direccion ? direccion.port : puertoPedido;
      resolve({
        puerto: puertoPublico,
        url: `http://127.0.0.1:${puertoPublico}`,
        cerrar: async () => {
          for (const socket of sockets) {
            socket.destroy();
          }
          await new Promise<void>((resuelve, rechaza) => {
            server.close((error) => (error ? rechaza(error) : resuelve()));
          });
          await cerrarClientesAuditor();
        },
      });
    });
  });
}

async function main(): Promise<void> {
  const { iniciarTelemetria } = await import("../lib/observabilidad/otel");
  iniciarTelemetria();
  const puerto = Number(process.env.AUDITOR_PORT ?? PUERTO_POR_DEFECTO);
  const auditor = await iniciarAuditor({ puerto });
  console.log(`Auditor A2A escuchando en ${auditor.url}`);
}

if (esEntradaPrincipal()) {
  main().catch(() => {
    console.error("No se pudo arrancar el auditor.");
    process.exit(1);
  });
}
