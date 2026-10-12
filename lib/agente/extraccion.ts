import { generateObject } from "ai";
import { extraccionModeloSchema } from "@/mcp/esquemas";
import type { Extraccion, ProveedorExtraccion } from "@/lib/tipos";
import { crearModelo } from "./modelo";

// Token compartido con los servicios de modelos en Modal (deploy/modal).
// Sin MODELOS_TOKEN (modo local) no se envía cabecera.
function authModelos(): Record<string, string> {
  const token = process.env.MODELOS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const FESTIVOS_2026 = [
  "2026-01-01 Año Nuevo",
  "2026-01-12 Reyes Magos",
  "2026-03-23 San José",
  "2026-04-02 Jueves Santo",
  "2026-04-03 Viernes Santo",
  "2026-05-01 Día del Trabajo",
  "2026-05-18 Ascensión",
  "2026-06-08 Corpus Christi",
  "2026-06-15 Sagrado Corazón",
  "2026-06-29 San Pedro y San Pablo",
  "2026-07-13 Virgen del Carmen",
  "2026-07-20 Independencia",
  "2026-08-07 Batalla de Boyacá",
  "2026-08-17 Asunción",
  "2026-10-12 Día de la Raza",
  "2026-11-02 Todos los Santos",
  "2026-11-16 Independencia de Cartagena",
  "2026-12-08 Inmaculada",
  "2026-12-25 Navidad",
].join("\n");

export function systemExtractor(fechaIso: string): string {
  return [
    "Eres el extractor de órdenes de turnos de Relevo, una clínica colombiana.",
    "Devuelve solo el objeto pedido. No expliques.",
    `La fecha de hoy es ${fechaIso} (America/Bogota). Resuelve las fechas relativas contra ese día.`,
    "",
    "Fechas:",
    "- mañana = hoy + 1. pasado mañana = hoy + 2. de hoy en ocho = hoy + 8.",
    "- la otra semana = de lunes a domingo de la semana siguiente. La semana empieza el lunes.",
    "- esta semana = desde hoy hasta el domingo, salvo que pidan la semana completa (lunes a domingo).",
    "- el finde = el sábado y el domingo más próximos, incluyendo hoy si ya es fin de semana.",
    "- el puente = el próximo festivo de la lista y los días que arman el puente (si cae lunes, el fin de semana anterior).",
    "- Toda la otra semana produce una fecha por día.",
    "",
    "Festivos Colombia 2026 (Ley 51 de 1983):",
    FESTIVOS_2026,
    "",
    "accion:",
    "- asignar: poner, cambiar o doblar un turno.",
    "- ausencia: vacaciones, incapacidad, permiso o licencia.",
    "- quitar: cancelar o sacar un turno.",
    "turno: M mañana, T tarde, N noche. null si no aplica.",
    "fechas: lista ISO YYYY-MM-DD, sin horas.",
    "justificacion: motivo en texto, o null.",
    "empleado: el nombre tal como viene en la orden, sin inventar apellidos.",
  ].join("\n");
}

export type GenerarExtraccion = (entrada: {
  system: string;
  prompt: string;
}) => Promise<unknown>;

export type OpcionesExtraccion = {
  generar?: GenerarExtraccion;
  fetcher?: typeof fetch;
  /** null fuerza no llamar al extractor afinado. Omitido lee EXTRACTOR_URL. */
  urlExtractor?: string | null;
};

function urlDesdeEntorno(): string | null {
  const valor = process.env.EXTRACTOR_URL?.trim();
  if (!valor) {
    return null;
  }
  return valor.replace(/\/$/, "");
}

function urlEfectiva(opciones?: OpcionesExtraccion): string | null {
  if (opciones && "urlExtractor" in opciones) {
    const valor = opciones.urlExtractor?.trim();
    return valor ? valor.replace(/\/$/, "") : null;
  }
  return urlDesdeEntorno();
}

function vacioANull(valor: unknown): unknown {
  if (typeof valor !== "string") {
    return valor;
  }
  const recorte = valor.trim();
  return recorte.length === 0 ? null : recorte;
}

function normalizarCrudo(valor: unknown): unknown {
  const base =
    valor && typeof valor === "object" && "extraccion" in valor
      ? (valor as { extraccion: unknown }).extraccion
      : valor;
  if (!base || typeof base !== "object") {
    return base;
  }
  const fila = base as Record<string, unknown>;
  return {
    empleado: typeof fila.empleado === "string" ? fila.empleado.trim() : fila.empleado,
    turno: vacioANull(fila.turno),
    fechas: Array.isArray(fila.fechas) ? fila.fechas : [],
    justificacion: vacioANull(fila.justificacion),
    accion: typeof fila.accion === "string" ? fila.accion.trim() : fila.accion,
  };
}

function conProveedor(
  valor: unknown,
  proveedor: ProveedorExtraccion,
): Extraccion {
  const modelo = extraccionModeloSchema.parse(normalizarCrudo(valor));
  return { ...modelo, proveedor };
}

async function extraerConGrok(
  ordenTexto: string,
  fechaIso: string,
  opciones?: OpcionesExtraccion,
): Promise<Extraccion> {
  const system = systemExtractor(fechaIso);
  if (opciones?.generar) {
    return conProveedor(
      await opciones.generar({ system, prompt: ordenTexto }),
      "xai",
    );
  }
  const modelo = crearModelo();
  if (!modelo) {
    throw new Error("Sin XAI_API_KEY");
  }
  const { object } = await generateObject({
    model: modelo,
    schema: extraccionModeloSchema,
    system,
    prompt: ordenTexto,
  });
  return conProveedor(object, "xai");
}

async function extraerConLora(
  ordenTexto: string,
  fechaIso: string,
  url: string,
  fetcher: typeof fetch,
): Promise<Extraccion> {
  const respuesta = await fetcher(`${url}/extraer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authModelos() },
    body: JSON.stringify({ orden: ordenTexto, fecha_referencia: fechaIso }),
    signal: AbortSignal.timeout(8000),
  });
  if (!respuesta.ok) {
    throw new Error("extractor");
  }
  return conProveedor(await respuesta.json(), "lora");
}

/** Orden coloquial → extracción. LoRA primero si hay URL; si falla, Grok. */
export async function extraerOrden(
  ordenTexto: string,
  fechaIso: string,
  opciones?: OpcionesExtraccion,
): Promise<Extraccion> {
  const url = urlEfectiva(opciones);
  if (url) {
    try {
      return await extraerConLora(
        ordenTexto,
        fechaIso,
        url,
        opciones?.fetcher ?? fetch,
      );
    } catch {
      // El servicio afinado es opcional: se cae al modelo de chat.
    }
  }
  try {
    return await extraerConGrok(ordenTexto, fechaIso, opciones);
  } catch (error) {
    if (error instanceof Error && error.message === "Sin XAI_API_KEY") {
      throw new Error("No hay modelo de extracción disponible.");
    }
    throw new Error("No se pudo extraer la orden.");
  }
}
