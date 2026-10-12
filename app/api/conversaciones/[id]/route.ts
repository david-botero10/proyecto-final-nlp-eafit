import { crearCliente } from "@/lib/db/cliente";
import { eliminarConversacion } from "@/lib/memoria/conversaciones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(mensaje: string, status: number): Response {
  return Response.json({ error: mensaje }, { status });
}

export async function DELETE(
  peticion: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  if (!UUID.test(id)) {
    return jsonError("id no es un UUID válido.", 400);
  }
  const usuario = (
    new URL(peticion.url).searchParams.get("usuario") ?? ""
  ).trim();
  if (usuario.length === 0 || usuario.length > 80) {
    return jsonError("usuario no es válido.", 400);
  }
  const { sql, cerrar } = crearCliente();
  try {
    const resultado = await eliminarConversacion(sql, id, usuario);
    if (resultado === "no_encontrada") {
      return jsonError("No existe esa conversación para este usuario.", 404);
    }
    return Response.json({ ok: true });
  } catch {
    return jsonError("No se pudo eliminar la conversación.", 500);
  } finally {
    await cerrar();
  }
}
