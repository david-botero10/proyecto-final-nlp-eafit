import { crearCliente } from "@/lib/db/cliente";
import { listarConversaciones } from "@/lib/memoria/conversaciones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(mensaje: string, status: number): Response {
  return Response.json({ error: mensaje }, { status });
}

export async function GET(peticion: Request): Promise<Response> {
  const usuario = (
    new URL(peticion.url).searchParams.get("usuario") ?? ""
  ).trim();
  if (usuario.length === 0 || usuario.length > 80) {
    return jsonError("usuario no es válido.", 400);
  }
  const { sql, cerrar } = crearCliente();
  try {
    const conversaciones = await listarConversaciones(sql, usuario);
    return Response.json({ conversaciones });
  } catch {
    return jsonError("No se pudo leer el historial.", 500);
  } finally {
    await cerrar();
  }
}
