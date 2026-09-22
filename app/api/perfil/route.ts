import { crearCliente } from "@/lib/db/cliente";
import {
  actualizarPerfil,
  leerPerfil,
  sembrarPerfilesSiVacio,
} from "@/lib/memoria/perfiles";

export const dynamic = "force-dynamic";

function jsonError(mensaje: string, status: number): Response {
  return Response.json({ error: mensaje }, { status });
}

function usuarioDe(peticion: Request): string | Response {
  const usuario = new URL(peticion.url).searchParams.get("usuario")?.trim() ?? "";
  if (usuario.length === 0 || usuario.length > 80) {
    return jsonError("usuario no es válido.", 400);
  }
  return usuario;
}

function leerCambios(valor: unknown): {
  rol: string;
  equipo: string;
  preferencias: Record<string, unknown> | null;
} | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }
  const fila = valor as {
    rol?: unknown;
    equipo?: unknown;
    preferencias?: unknown;
  };
  if (typeof fila.rol !== "string" || fila.rol.trim().length === 0) {
    return null;
  }
  if (typeof fila.equipo !== "string" || fila.equipo.trim().length === 0) {
    return null;
  }
  if (
    fila.preferencias != null &&
    (typeof fila.preferencias !== "object" || Array.isArray(fila.preferencias))
  ) {
    return null;
  }
  return {
    rol: fila.rol.trim(),
    equipo: fila.equipo.trim(),
    preferencias:
      fila.preferencias == null
        ? null
        : (fila.preferencias as Record<string, unknown>),
  };
}

export async function GET(peticion: Request): Promise<Response> {
  const usuario = usuarioDe(peticion);
  if (usuario instanceof Response) {
    return usuario;
  }
  const { sql, cerrar } = crearCliente();
  try {
    await sembrarPerfilesSiVacio(sql);
    const perfil = await leerPerfil(sql, usuario);
    if (!perfil) {
      return jsonError("No hay un perfil para ese usuario.", 404);
    }
    return Response.json(perfil);
  } catch {
    return jsonError("No se pudo leer el perfil.", 500);
  } finally {
    await cerrar();
  }
}

export async function PUT(peticion: Request): Promise<Response> {
  const usuario = usuarioDe(peticion);
  if (usuario instanceof Response) {
    return usuario;
  }
  let json: unknown;
  try {
    json = await peticion.json();
  } catch {
    return jsonError("El cuerpo de la petición no es JSON válido.", 400);
  }
  const cambios = leerCambios(json);
  if (!cambios) {
    return jsonError("El cuerpo de la petición no es válido.", 400);
  }
  const { sql, cerrar } = crearCliente();
  try {
    await sembrarPerfilesSiVacio(sql);
    const perfil = await actualizarPerfil(sql, usuario, cambios);
    if (!perfil) {
      return jsonError("No hay un perfil para ese usuario.", 404);
    }
    return Response.json(perfil);
  } catch {
    return jsonError("No se pudo actualizar el perfil.", 500);
  } finally {
    await cerrar();
  }
}
