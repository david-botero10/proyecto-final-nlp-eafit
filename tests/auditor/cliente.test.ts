/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";
import { auditarPropuesta, olvidarCacheAuditor } from "@/lib/a2a/cliente";
import { propuestaTurno } from "./ayuda";

describe("cliente A2A", () => {
  const previoUrl = process.env.AUDITOR_URL;
  const previoTimeout = process.env.AUDITOR_TIMEOUT_MS;

  afterEach(() => {
    if (previoUrl === undefined) {
      delete process.env.AUDITOR_URL;
    } else {
      process.env.AUDITOR_URL = previoUrl;
    }
    if (previoTimeout === undefined) {
      delete process.env.AUDITOR_TIMEOUT_MS;
    } else {
      process.env.AUDITOR_TIMEOUT_MS = previoTimeout;
    }
    olvidarCacheAuditor();
  });

  it("devuelve null sin lanzar si el servicio no responde", async () => {
    process.env.AUDITOR_URL = "http://127.0.0.1:9";
    process.env.AUDITOR_TIMEOUT_MS = "800";
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-caido",
        turno: "M",
        fecha: "2026-09-28",
      }),
    );
    expect(veredicto).toBeNull();
  });
});
