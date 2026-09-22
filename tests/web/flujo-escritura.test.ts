/** @vitest-environment node */
import { procesarOrdenEscritura } from "@/lib/agente/flujo-escritura";
import type { Extraccion, Propuesta } from "@/lib/tipos";
import { describe, expect, it } from "vitest";

const EXTRACCION: Extraccion = {
  empleado: "Ana",
  turno: "M",
  fechas: ["2026-09-28", "2026-09-29"],
  justificacion: null,
  accion: "asignar",
  proveedor: "xai",
};

const VISTA: Propuesta = {
  propuesta_id: "22222222-2222-4222-8222-222222222222",
  estado: "pendiente",
  usuario: "coordinador",
  orden_texto: "ponle la mañana a Ana",
  extraccion: EXTRACCION,
  acciones: [
    {
      tipo: "asignar_turno",
      empleado_id: 24,
      turno: "M",
      fecha: "2026-09-28",
    },
    {
      tipo: "asignar_turno",
      empleado_id: 24,
      turno: "M",
      fecha: "2026-09-29",
    },
  ],
  contexto: { solapes_detectados: [], ausencias_en_rango: [] },
  veredicto_auditor: null,
  nombres: [{ id: 24, nombre: "Ana Mery Montoya Patiño" }],
};

describe("flujo de orden de escritura", () => {
  it("extrae, consulta y crea la propuesta", async () => {
    const llamadas: string[] = [];
    const resultado = await procesarOrdenEscritura("ponle la mañana a Ana", {
      hoy: "2026-09-21",
      extraer: async () => EXTRACCION,
      leerEmpleados: async () => {
        llamadas.push("empleados");
        return [
          { id: 24, nombre: "Ana Mery Montoya Patiño" },
          { id: 1, nombre: "María Marcela Torres" },
        ];
      },
      leerTurnos: async (desde, hasta, empleadoId) => {
        llamadas.push(`turnos:${empleadoId}:${desde}:${hasta}`);
        return { asignaciones: [] };
      },
      leerAusencias: async () => {
        llamadas.push("ausencias");
        return { ausencias: [] };
      },
      crear: async (entrada) => {
        llamadas.push("crear");
        expect(entrada.acciones).toEqual(VISTA.acciones);
        expect(entrada.extraccion.proveedor).toBe("xai");
        return VISTA;
      },
    });

    expect(llamadas).toEqual([
      "empleados",
      "turnos:24:2026-09-28:2026-09-29",
      "ausencias",
      "crear",
    ]);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.texto).toMatch(/Te propongo/);
      expect(resultado.texto.toLowerCase()).toContain("revisa la tarjeta");
      expect(resultado.propuesta.propuesta_id).toBe(VISTA.propuesta_id);
    }
  });

  it("no crea la propuesta si el nombre es ambiguo", async () => {
    let creo = false;
    const resultado = await procesarOrdenEscritura("turno para María", {
      hoy: "2026-09-21",
      extraer: async () => ({ ...EXTRACCION, empleado: "María" }),
      leerEmpleados: async () => [
        { id: 1, nombre: "María Marcela Torres" },
        { id: 2, nombre: "María López" },
      ],
      leerTurnos: async () => ({ asignaciones: [] }),
      leerAusencias: async () => ({ ausencias: [] }),
      crear: async () => {
        creo = true;
        return VISTA;
      },
    });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.texto).toMatch(/varios empleados/i);
    }
    expect(creo).toBe(false);
  });

  it("una ausencia usa el rango y el tipo", async () => {
    let acciones: unknown;
    const resultado = await procesarOrdenEscritura("Ana está incapacitada", {
      hoy: "2026-09-21",
      extraer: async () => ({
        ...EXTRACCION,
        turno: null,
        accion: "ausencia",
        justificacion: "está incapacitada",
        fechas: ["2026-09-29", "2026-09-28"],
      }),
      leerEmpleados: async () => [{ id: 24, nombre: "Ana Mery Montoya Patiño" }],
      leerTurnos: async () => ({ asignaciones: [] }),
      leerAusencias: async () => ({ ausencias: [] }),
      crear: async (entrada) => {
        acciones = entrada.acciones;
        return VISTA;
      },
    });
    expect(resultado.ok).toBe(true);
    expect(acciones).toEqual([
      {
        tipo: "registrar_ausencia",
        empleado_id: 24,
        tipo_ausencia: "incapacidad",
        fecha_inicio: "2026-09-28",
        fecha_fin: "2026-09-29",
        motivo: "está incapacitada",
      },
    ]);
  });
  it("adjunta el veredicto del auditor A2A a la propuesta y tolera que no responda", async () => {
    const deps = {
      hoy: "2026-09-21",
      extraer: async () => EXTRACCION,
      leerEmpleados: async () => [{ id: 24, nombre: "Ana Mery Montoya Patiño" }],
      leerTurnos: async () => ({ asignaciones: [] }),
      leerAusencias: async () => ({ ausencias: [] }),
      crear: async () => VISTA,
    };

    const veredicto = {
      propuesta_id: VISTA.propuesta_id,
      veredicto: "observaciones" as const,
      razones: ["El 2026-09-28 cae en lunes festivo."],
      normas_citadas: [{ fuente: "cst_pr006", articulo: "179", chunk_id: 193 }],
      verificaciones: {
        empleado_existe: true,
        sin_solapes: true,
        jornada_dentro_de_limites: true,
      },
    };
    const conVeredicto = await procesarOrdenEscritura("ponle la mañana a Ana", {
      ...deps,
      auditar: async (propuesta) => {
        expect(propuesta.propuesta_id).toBe(VISTA.propuesta_id);
        return veredicto;
      },
    });
    expect(conVeredicto.ok).toBe(true);
    if (conVeredicto.ok) {
      expect(conVeredicto.propuesta.veredicto_auditor).toEqual(veredicto);
    }

    const sinAuditor = await procesarOrdenEscritura("ponle la mañana a Ana", {
      ...deps,
      auditar: async () => {
        throw new Error("auditor caído");
      },
    });
    expect(sinAuditor.ok).toBe(true);
    if (sinAuditor.ok) {
      expect(sinAuditor.propuesta.veredicto_auditor).toBeNull();
    }
  });
});
