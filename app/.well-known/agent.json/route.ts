import { CABECERA_TOKEN, tokenAuditorValido } from "@/auditor/a2a";
import { construirAgentCard } from "@/auditor/agent-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Origen público: AUDITOR_PUBLIC_URL, o el de la petición (con proxy). */
function origenPublico(peticion: Request): string {
  const fijo = process.env.AUDITOR_PUBLIC_URL?.trim();
  if (fijo) {
    return fijo.replace(/\/$/, "");
  }
  const url = new URL(peticion.url);
  const host = peticion.headers.get("x-forwarded-host") ?? url.host;
  const protocolo =
    peticion.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    url.protocol.replace(":", "");
  return `${protocolo}://${host}`;
}

export async function GET(peticion: Request) {
  if (!tokenAuditorValido(peticion.headers.get(CABECERA_TOKEN))) {
    return Response.json(
      { error: "Token del auditor ausente o inválido." },
      { status: 401 },
    );
  }
  return Response.json(construirAgentCard(origenPublico(peticion)));
}
