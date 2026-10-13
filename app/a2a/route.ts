import {
  CABECERA_TOKEN,
  errorCuerpoNoValido,
  procesarJsonRpc,
  TOPE_CUERPO,
  tokenAuditorValido,
} from "@/auditor/a2a";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(peticion: Request) {
  if (!tokenAuditorValido(peticion.headers.get(CABECERA_TOKEN))) {
    return Response.json(
      { error: "Token del auditor ausente o inválido." },
      { status: 401 },
    );
  }
  let texto: string;
  try {
    texto = await peticion.text();
  } catch {
    return Response.json(errorCuerpoNoValido());
  }
  if (texto.length > TOPE_CUERPO) {
    return Response.json(errorCuerpoNoValido());
  }
  return Response.json(await procesarJsonRpc(texto));
}
