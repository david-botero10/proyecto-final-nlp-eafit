import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { solicitudSchema } from "../lib/a2a/esquemas";
import { construirAgentCard } from "./agent-card";
import { cerrarClientesAuditor } from "./mcp";
import { redactarRazones } from "./razones";
import { verificar } from "./verificaciones";
import { construirVeredicto } from "./veredicto";

const PUERTO_POR_DEFECTO = 8641;
const TOPE_CUERPO = 1_000_000;

type IdRpc = string | number | null;

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

function errorRpc(id: IdRpc, codigo: number, mensaje: string) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: { code: codigo, message: mensaje },
  };
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

function idRpc(valor: unknown): IdRpc | undefined {
  if (valor === null || typeof valor === "string" || typeof valor === "number") {
    return valor;
  }
  return undefined;
}

function mensajeRegistro(error: unknown): string {
  if (!(error instanceof Error)) {
    return "error desconocido";
  }
  if (/password|postgresql:\/\//i.test(error.message)) {
    return "error de base de datos";
  }
  return error.message;
}

async function auditarCuerpo(datos: unknown) {
  const solicitud = solicitudSchema.parse(datos);
  const hallazgos = await verificar(solicitud);
  const veredicto = construirVeredicto(solicitud.propuesta_id, hallazgos);
  veredicto.razones = await redactarRazones(
    veredicto.razones,
    veredicto.veredicto,
  );
  return veredicto;
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

async function manejarA2a(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let texto: string;
  try {
    texto = await leerCuerpo(req);
  } catch {
    responder(
      res,
      200,
      errorRpc(null, -32600, "La petición JSON-RPC no es válida."),
    );
    return;
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto) as unknown;
  } catch {
    responder(res, 200, errorRpc(null, -32700, "El cuerpo no es JSON válido."));
    return;
  }

  if (Array.isArray(cuerpo) || !cuerpo || typeof cuerpo !== "object") {
    responder(
      res,
      200,
      errorRpc(null, -32600, "La petición JSON-RPC no es válida."),
    );
    return;
  }

  const peticion = cuerpo as Record<string, unknown>;
  const id = idRpc(peticion.id);
  if (
    peticion.jsonrpc !== "2.0" ||
    typeof peticion.method !== "string" ||
    id === undefined
  ) {
    responder(
      res,
      200,
      errorRpc(id ?? null, -32600, "La petición JSON-RPC no es válida."),
    );
    return;
  }

  if (peticion.method === "tasks/get") {
    responder(
      res,
      200,
      errorRpc(id, -32001, "La tarea no está persistida."),
    );
    return;
  }

  if (peticion.method !== "message/send") {
    responder(res, 200, errorRpc(id, -32601, "Método no encontrado."));
    return;
  }

  const params = peticion.params;
  const message =
    params && typeof params === "object"
      ? (params as { message?: { parts?: unknown[] } }).message
      : undefined;
  const partes = message?.parts;
  const primera = Array.isArray(partes) ? partes[0] : undefined;
  const datos =
    primera &&
    typeof primera === "object" &&
    (primera as { kind?: unknown }).kind === "data"
      ? (primera as { data?: unknown }).data
      : undefined;
  if (datos === undefined) {
    responder(res, 200, errorRpc(id, -32602, "Parámetros inválidos."));
    return;
  }

  const parsed = solicitudSchema.safeParse(datos);
  if (!parsed.success) {
    const detalle = parsed.error.issues[0]?.message ?? "revisa la solicitud";
    responder(
      res,
      200,
      errorRpc(id, -32602, `Parámetros inválidos. ${detalle}`),
    );
    return;
  }

  try {
    const veredicto = await auditarCuerpo(parsed.data);
    responder(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        id: randomUUID(),
        contextId: veredicto.propuesta_id,
        kind: "task",
        status: { state: "completed" },
        artifacts: [
          {
            artifactId: randomUUID(),
            name: "veredicto_auditoria",
            parts: [{ kind: "data", data: veredicto }],
          },
        ],
      },
    });
  } catch (error) {
    console.error(`Auditor: ${mensajeRegistro(error)}`);
    responder(
      res,
      200,
      errorRpc(id, -32603, "No se pudo completar la auditoría."),
    );
  }
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
    if (req.method === "GET" && url === "/.well-known/agent.json") {
      responder(res, 200, construirAgentCard(basePublica(req, puertoPublico)));
      return;
    }
    if (url === "/a2a" && req.method === "POST") {
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
