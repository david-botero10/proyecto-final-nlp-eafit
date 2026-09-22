/** @vitest-environment node */
import { iniciarAuditor, type AuditorEnMarcha } from "@/auditor/servidor";
import { auditarPropuesta, olvidarCacheAuditor } from "@/lib/a2a/cliente";
import { crearCliente } from "@/lib/db/cliente";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { escenariosExtra } from "../../evaluacion/escenarios_extra";
import { citaArticulo } from "../auditor/ayuda";

async function hayBase(): Promise<boolean> {
  const cliente = crearCliente();
  try {
    await cliente.sql`SELECT 1 AS ok`;
    return true;
  } catch {
    return false;
  } finally {
    await cliente.cerrar();
  }
}

const bdActiva = await hayBase();
if (!bdActiva) {
  throw new Error("Se necesita PostgreSQL en localhost:5432 con el seed de Relevo.");
}

describe("diez escenarios extra del auditor", () => {
  let auditor: AuditorEnMarcha;
  const embedPrevio = process.env.EMBED_SERVICE_URL;
  const xaiPrevia = process.env.XAI_API_KEY;
  const urlPrevia = process.env.AUDITOR_URL;
  const escenarios = escenariosExtra();

  beforeAll(async () => {
    process.env.EMBED_SERVICE_URL = "http://127.0.0.1:9";
    process.env.AUDITOR_RAZONES_LLM = "0";
    delete process.env.XAI_API_KEY;
    auditor = await iniciarAuditor({ puerto: 0 });
    process.env.AUDITOR_URL = auditor.url;
    olvidarCacheAuditor();
  });

  afterAll(async () => {
    if (embedPrevio === undefined) {
      delete process.env.EMBED_SERVICE_URL;
    } else {
      process.env.EMBED_SERVICE_URL = embedPrevio;
    }
    delete process.env.AUDITOR_RAZONES_LLM;
    if (xaiPrevia === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = xaiPrevia;
    }
    if (urlPrevia === undefined) {
      delete process.env.AUDITOR_URL;
    } else {
      process.env.AUDITOR_URL = urlPrevia;
    }
    olvidarCacheAuditor();
    await auditor.cerrar();
  });

  it.each(escenarios.map((escenario) => [escenario.id, escenario] as const))(
    "%s coincide con la clase esperada",
    async (_id, escenario) => {
      const veredicto = await auditarPropuesta(escenario.propuesta);
      expect(veredicto).not.toBeNull();
      expect(veredicto?.veredicto).toBe(escenario.esperado);
      const texto = veredicto?.razones.join(" ") ?? "";
      if (escenario.id === "f1-festivo-trasladado") {
        expect(texto).toMatch(/festivo|Reyes/);
        expect(veredicto && citaArticulo(veredicto, "179")).toBe(true);
      }
      if (escenario.id === "f1-reyes-calendario") {
        expect(veredicto?.normas_citadas).toEqual([]);
      }
      if (escenario.id === "f1-ausencia-cruza-semanas") {
        expect(texto).toMatch(/turnos activos/);
        expect(veredicto?.verificaciones.sin_solapes).toBe(false);
      }
      if (escenario.id === "f1-noche-hacia-domingo") {
        expect(texto).toMatch(/nocturn/);
        expect(texto).not.toMatch(/domingo/);
        expect(veredicto && citaArticulo(veredicto, "168")).toBe(true);
      }
      if (escenario.id === "f1-no-activo") {
        expect(veredicto?.verificaciones.empleado_existe).toBe(false);
        expect(texto).toMatch(/no existe o no está activo/);
      }
      if (escenario.id === "f1-dos-turnos") {
        expect(veredicto?.verificaciones.sin_solapes).toBe(false);
      }
      if (escenario.id === "f1-pasa-44") {
        expect(veredicto?.verificaciones.jornada_dentro_de_limites).toBe(false);
        expect(texto).toMatch(/48 horas/);
      }
      if (escenario.id === "f1-reemplazo") {
        expect(veredicto?.verificaciones.sin_solapes).toBe(false);
        expect(texto).toMatch(/ausencia aprobada/);
      }
      if (escenario.id === "f1-ausencia-sin-turno") {
        expect(veredicto?.verificaciones).toEqual({
          empleado_existe: true,
          sin_solapes: true,
          jornada_dentro_de_limites: true,
        });
      }
      if (escenario.id === "f1-noche-domingo") {
        expect(texto).toMatch(/domingo/);
        expect(texto).toMatch(/nocturn/);
        expect(veredicto && citaArticulo(veredicto, "179")).toBe(true);
        expect(veredicto && citaArticulo(veredicto, "168")).toBe(true);
      }
    },
  );
});
