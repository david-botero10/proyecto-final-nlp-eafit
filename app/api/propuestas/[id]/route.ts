import { crearCliente } from "@/lib/db/cliente";
import { leerPropuesta } from "@/mcp/escrituras";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_peticion: Request, contexto: Contexto) {
  const { id } = await contexto.params;
  const { sql, cerrar } = crearCliente();
  try {
    const propuesta = await leerPropuesta(sql, id);
    if (!propuesta) {
      return Response.json(
        { error: "No existe la propuesta." },
        { status: 404 },
      );
    }
    return Response.json(propuesta);
  } catch {
    return Response.json(
      { error: "No se pudo leer la propuesta." },
      { status: 500 },
    );
  } finally {
    await cerrar();
  }
}
