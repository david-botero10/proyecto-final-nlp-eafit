/** @vitest-environment node */
import { crearCliente } from "@/lib/db/cliente";
import { auditarPropuesta, auditarSolicitud, olvidarCacheAuditor } from "@/lib/a2a/cliente";
import { solicitudSchema } from "@/lib/a2a/esquemas";
import { iniciarAuditor, type AuditorEnMarcha } from "@/auditor/servidor";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  citaArticulo,
  EMPLEADO_INCAPACIDAD,
  EMPLEADO_ROTATIVO,
  propuestaTurno,
} from "./ayuda";

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
  throw new Error(
    "Se necesita PostgreSQL en localhost:5432 con el seed de Relevo.",
  );
}

describe("escenarios con trampa del auditor", () => {
  let auditor: AuditorEnMarcha;
  const embedPrevio = process.env.EMBED_SERVICE_URL;
  const xaiPrevia = process.env.XAI_API_KEY;
  const urlPrevia = process.env.AUDITOR_URL;

  beforeAll(async () => {
    process.env.EMBED_SERVICE_URL = "http://127.0.0.1:9";
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

  it("empleado inexistente → rechazado", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-inexistente",
        empleadoId: 999_999,
        turno: "M",
        fecha: "2026-09-28",
      }),
    );
    expect(veredicto).not.toBeNull();
    expect(veredicto?.veredicto).toBe("rechazado");
    expect(veredicto?.verificaciones.empleado_existe).toBe(false);
    expect(veredicto?.propuesta_id).toBe("p-inexistente");
  });

  it("turno duplicado el mismo día → rechazado", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-duplicado",
        turno: "M",
        fecha: "2026-08-03",
        orden: "Ponle la mañana el lunes 3 de agosto, aunque ya tiene tarde.",
      }),
    );
    expect(veredicto?.veredicto).toBe("rechazado");
    expect(veredicto?.verificaciones.empleado_existe).toBe(true);
    expect(veredicto?.verificaciones.sin_solapes).toBe(false);
  });

  it("turno dentro de una ausencia aprobada del seed → rechazado", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-ausencia",
        empleadoId: EMPLEADO_INCAPACIDAD,
        turno: "M",
        fecha: "2026-08-05",
        orden: "Asignar mañana durante la incapacidad aprobada.",
      }),
    );
    expect(veredicto?.veredicto).toBe("rechazado");
    expect(veredicto?.verificaciones.sin_solapes).toBe(false);
    expect(veredicto?.razones.join(" ")).toMatch(/ausencia aprobada/);
  });

  it("asignación en domingo → observaciones con el artículo 179", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-domingo",
        turno: "M",
        fecha: "2026-10-04",
        orden: "Ponle la mañana el domingo 4 de octubre.",
      }),
    );
    expect(veredicto?.veredicto).toBe("observaciones");
    expect(veredicto?.verificaciones).toMatchObject({
      empleado_existe: true,
      sin_solapes: true,
      jornada_dentro_de_limites: true,
    });
    expect(veredicto?.razones.join(" ")).toMatch(/domingo/);
    expect(veredicto && citaArticulo(veredicto, "179")).toBe(true);
  });

  it("asignación en festivo 2026-10-12 → observaciones", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-festivo",
        turno: "T",
        fecha: "2026-10-12",
        orden: "Cubre el festivo del 12 de octubre en la tarde.",
      }),
    );
    expect(veredicto?.veredicto).toBe("observaciones");
    expect(veredicto?.verificaciones.jornada_dentro_de_limites).toBe(true);
    expect(veredicto?.razones.join(" ")).toMatch(/festivo|Raza|fiesta/);
    expect(veredicto && citaArticulo(veredicto, "179")).toBe(true);
  });

  it("turno noche → observaciones con recargo nocturno citado", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-noche",
        turno: "N",
        fecha: "2026-09-29",
        orden: "Ponle el turno de la noche el martes 29 de septiembre.",
      }),
    );
    expect(veredicto?.veredicto).toBe("observaciones");
    expect(veredicto?.verificaciones.jornada_dentro_de_limites).toBe(true);
    expect(veredicto?.verificaciones.sin_solapes).toBe(true);
    expect(veredicto?.razones.join(" ")).toMatch(/nocturn/);
    expect(veredicto && citaArticulo(veredicto, "168")).toBe(true);
  });

  it("séptimo día de la semana → observaciones por límite", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-septimo",
        turno: "M",
        fecha: "2026-08-08",
        orden: "Cubre también el sábado 8 de agosto.",
      }),
    );
    expect(veredicto?.veredicto).toBe("observaciones");
    expect(veredicto?.verificaciones.sin_solapes).toBe(true);
    expect(veredicto?.verificaciones.jornada_dentro_de_limites).toBe(false);
    const texto = veredicto?.razones.join(" ") ?? "";
    expect(texto).toMatch(/7 días/);
    expect(texto).toMatch(/56 horas/);
  });

  it("ausencia sobre días con turnos activos → rechazado", async () => {
    const veredicto = await auditarSolicitud(
      solicitudSchema.parse({
        propuesta_id: "p-ausencia-turnos",
        orden_texto: "Registra vacaciones del 3 al 5 de agosto.",
        extraccion: {
          empleado: "Elizabeth María López",
          turno: "M",
          fechas: ["2026-08-03", "2026-08-04", "2026-08-05"],
          justificacion: "vacaciones",
        },
        acciones: [
          {
            tipo: "registrar_ausencia",
            empleado_id: EMPLEADO_ROTATIVO,
            tipo_ausencia: "vacaciones",
            fecha_inicio: "2026-08-03",
            fecha_fin: "2026-08-05",
            motivo: "descanso",
          },
        ],
        contexto: { solapes_detectados: [], ausencias_en_rango: [] },
      }),
    );
    expect(veredicto?.veredicto).toBe("rechazado");
    expect(veredicto?.verificaciones.sin_solapes).toBe(false);
    expect(veredicto?.razones.join(" ")).toMatch(/turnos activos/);
  });

  it("propuesta limpia → aprobado", async () => {
    const veredicto = await auditarPropuesta(
      propuestaTurno({
        id: "p-limpia",
        turno: "M",
        fecha: "2026-09-28",
        orden: "Ponle la mañana el lunes 28 de septiembre.",
      }),
    );
    expect(veredicto?.veredicto).toBe("aprobado");
    expect(veredicto?.verificaciones).toEqual({
      empleado_existe: true,
      sin_solapes: true,
      jornada_dentro_de_limites: true,
    });
    expect(veredicto?.normas_citadas).toEqual([]);
    expect(veredicto?.razones.length).toBeGreaterThan(0);
  });

  it("una acción limpia y otra en domingo → observaciones", async () => {
    const veredicto = await auditarPropuesta({
      propuesta_id: "p-mixta",
      orden_texto: "Mañana el lunes 28 y también el domingo 4.",
      extraccion: {
        empleado: "Elizabeth María López",
        turno: "M",
        fechas: ["2026-09-28", "2026-10-04"],
        justificacion: null,
        accion: "asignar",
        proveedor: "xai",
      },
      acciones: [
        {
          tipo: "asignar_turno",
          empleado_id: EMPLEADO_ROTATIVO,
          turno: "M",
          fecha: "2026-09-28",
        },
        {
          tipo: "asignar_turno",
          empleado_id: EMPLEADO_ROTATIVO,
          turno: "M",
          fecha: "2026-10-04",
        },
      ],
      contexto: { solapes_detectados: [], ausencias_en_rango: [] },
    });
    expect(veredicto?.veredicto).toBe("observaciones");
    expect(veredicto?.verificaciones).toMatchObject({
      empleado_existe: true,
      sin_solapes: true,
      jornada_dentro_de_limites: true,
    });
    expect(veredicto?.razones.join(" ")).toMatch(/2026-10-04/);
    expect(veredicto?.razones.join(" ")).toMatch(/domingo/);
    expect(veredicto && citaArticulo(veredicto, "179")).toBe(true);
  });
});
