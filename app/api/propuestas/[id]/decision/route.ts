import { crearCliente } from "@/lib/db/cliente";
import { ejecutarPropuesta, ErrorPropuesta } from "@/mcp/escrituras";
import { decisionEntrada } from "@/mcp/esquemas";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(peticion: Request, contexto: Contexto) {
  const { id } = await contexto.params;
  let json: unknown;
  try {
    json = await peticion.json();
  } catch {
    return Response.json(
      { error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const analizado = decisionEntrada.safeParse(json);
  if (!analizado.success) {
    return Response.json(
      { error: "El cuerpo de la petición no es válido." },
      { status: 400 },
    );
  }

  const { sql, cerrar } = crearCliente();
  try {
    const resumen = await ejecutarPropuesta(sql, {
      propuesta_id: id,
      decision: analizado.data.decision,
      correccion: analizado.data.correccion,
      usuario: analizado.data.usuario.trim(),
    });
    return Response.json(resumen);
  } catch (error) {
    if (error instanceof ErrorPropuesta) {
      const status =
        error.codigo === "no_encontrada"
          ? 404
          : error.codigo === "validacion"
            ? 400
            : 409;
      return Response.json({ error: error.message }, { status });
    }
    return Response.json(
      { error: "No se pudo ejecutar la propuesta." },
      { status: 500 },
    );
  } finally {
    await cerrar();
  }
}
