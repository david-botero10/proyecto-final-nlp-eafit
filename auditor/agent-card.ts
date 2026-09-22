import { agentCardSchema, type AgentCard } from "../lib/a2a/esquemas";

/** Agent Card A2A servida en `GET /.well-known/agent.json`. */
export function construirAgentCard(urlBase: string): AgentCard {
  return agentCardSchema.parse({
    name: "Relevo Auditor",
    description:
      "Auditor independiente de propuestas de turnos y ausencias. Verifica empleado, solapes, jornada y recargos, y devuelve un veredicto.",
    url: urlBase.replace(/\/$/, ""),
    version: "0.1.0",
    capabilities: { streaming: false },
    skills: [
      {
        id: "auditar_propuesta",
        name: "Auditar propuesta",
        description:
          "Recibe una solicitud_auditoria y responde un veredicto_auditoria (aprobado, observaciones o rechazado).",
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
    ],
  });
}
