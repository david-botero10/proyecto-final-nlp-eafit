"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { TarjetaPropuesta } from "@/components/tarjeta-propuesta";
import { actividadDe, type ActividadHerramienta } from "@/lib/ui/herramientas";
import type { Propuesta } from "@/lib/tipos";
import { ActividadHerramientas } from "./actividad-herramientas";
import {
  PanelFuentes,
  idFuente,
  type ResultadoFuente,
} from "./fuentes";
import { Markdown } from "./markdown";

export type { ResultadoFuente } from "./fuentes";
export { PanelFuentes } from "./fuentes";

export type ParteVista = {
  type: string;
  text?: string;
  state?: string;
  toolName?: string;
  data?: unknown;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const ETIQUETAS: Record<string, string> = {
  charla: "charla",
  consulta_datos: "consulta de datos",
  consulta_norma: "consulta de norma",
  orden_escritura: "orden de escritura",
};

function esResultado(valor: unknown): valor is ResultadoFuente {
  if (!valor || typeof valor !== "object") {
    return false;
  }
  const fila = valor as Record<string, unknown>;
  return (
    typeof fila.chunk_id === "number" &&
    typeof fila.fuente === "string" &&
    typeof fila.titulo === "string" &&
    typeof fila.fragmento === "string" &&
    typeof fila.score === "number" &&
    (fila.ref === null || typeof fila.ref === "string") &&
    (fila.url === null || typeof fila.url === "string")
  );
}

function leerResultados(salida: unknown): ResultadoFuente[] {
  if (!salida || typeof salida !== "object" || !("resultados" in salida)) {
    return [];
  }
  const lista = (salida as { resultados: unknown }).resultados;
  if (!Array.isArray(lista)) {
    return [];
  }
  return lista.filter(esResultado);
}

function esBuscarNorma(parte: ParteVista): boolean {
  if (parte.type === "tool-buscar_norma") {
    return true;
  }
  return parte.type === "dynamic-tool" && parte.toolName === "buscar_norma";
}

function esHerramienta(parte: ParteVista): boolean {
  return parte.type.startsWith("tool-") || parte.type === "dynamic-tool";
}

function enCurso(parte: ParteVista): boolean {
  return parte.state === "input-streaming" || parte.state === "input-available";
}

export function indicadorDePartes(parts: ParteVista[]): string | null {
  if (parts.some((parte) => esBuscarNorma(parte) && enCurso(parte))) {
    return "consultando norma…";
  }
  if (parts.some((parte) => esHerramienta(parte) && enCurso(parte))) {
    return "consultando…";
  }
  return null;
}

function intencionDe(parts: ParteVista[]): string | null {
  for (const parte of parts) {
    if (parte.type !== "data-intencion" || !parte.data) {
      continue;
    }
    if (typeof parte.data !== "object" || !("intencion" in parte.data)) {
      continue;
    }
    const intencion = (parte.data as { intencion?: unknown }).intencion;
    if (typeof intencion === "string" && intencion.length > 0) {
      return intencion;
    }
  }
  return null;
}

export function gruposFuentes(parts: ParteVista[]): ResultadoFuente[][] {
  const grupos: ResultadoFuente[][] = [];
  for (const parte of parts) {
    if (!esBuscarNorma(parte) || parte.state !== "output-available") {
      continue;
    }
    const resultados = leerResultados(parte.output);
    if (resultados.length > 0) {
      grupos.push(resultados);
    }
  }
  return grupos;
}

function esPropuesta(valor: unknown): valor is Propuesta {
  if (!valor || typeof valor !== "object") {
    return false;
  }
  const fila = valor as Partial<Propuesta>;
  return (
    typeof fila.propuesta_id === "string" &&
    typeof fila.orden_texto === "string" &&
    Array.isArray(fila.acciones) &&
    fila.extraccion !== undefined &&
    fila.contexto !== undefined &&
    fila.contexto !== null
  );
}

function propuestasDe(parts: ParteVista[]): Propuesta[] {
  const propuestas: Propuesta[] = [];
  for (const parte of parts) {
    if (parte.type === "data-propuesta" && esPropuesta(parte.data)) {
      propuestas.push(parte.data);
    }
  }
  return propuestas;
}

function actividadesDe(parts: ParteVista[]): ActividadHerramienta[] {
  return parts.flatMap((parte) => {
    if (!esHerramienta(parte)) {
      return [];
    }
    const actividad = actividadDe(parte);
    return actividad ? [actividad] : [];
  });
}

export function ChipIntencion({ intencion }: { intencion: string }) {
  const etiqueta = ETIQUETAS[intencion] ?? intencion;
  return (
    <span className="inline-flex rounded-full bg-sand px-2.5 py-0.5 text-[11.5px] font-medium text-muted">
      {etiqueta}
    </span>
  );
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) {
      return;
    }
    const temporizador = window.setTimeout(() => setCopiado(false), 1800);
    return () => window.clearTimeout(temporizador);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles no hay nada más que hacer.
    }
  }

  return (
    <button
      type="button"
      aria-label={copiado ? "Copiado" : "Copiar respuesta"}
      className="inline-flex items-center gap-1.5 rounded-fila px-2 py-1 text-xs font-medium text-subtle hover:bg-sand hover:text-ink"
      onClick={() => void copiar()}
    >
      {copiado ? (
        <Check size={14} aria-hidden="true" className="text-success" />
      ) : (
        <Copy size={14} aria-hidden="true" />
      )}
      <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
    </button>
  );
}

export function MensajeAsistente({
  parts,
  completo = true,
}: {
  parts: ParteVista[];
  /** False mientras la respuesta aún se está generando (oculta las acciones). */
  completo?: boolean;
}) {
  const prefijo = useId().replaceAll(":", "");
  const texto = parts
    .filter((parte) => parte.type === "text" && parte.text)
    .map((parte) => parte.text ?? "")
    .join("\n\n");
  const intencion = intencionDe(parts);
  const actividades = actividadesDe(parts);
  const grupos = gruposFuentes(parts);
  const propuestas = propuestasDe(parts);

  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState<number | null>(null);

  const alCitar = useCallback((numero: number) => {
    setAbierto(true);
    setResaltada(numero);
  }, []);

  useEffect(() => {
    if (resaltada === null) {
      return;
    }
    document
      .getElementById(idFuente(`${prefijo}0`, resaltada))
      ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    const temporizador = window.setTimeout(() => setResaltada(null), 2600);
    return () => window.clearTimeout(temporizador);
  }, [resaltada, prefijo]);

  return (
    <div className="rounded-tarjeta border border-line bg-surface px-4 py-3.5 shadow-suave sm:px-5">
      {intencion ? (
        <div className="mb-2.5">
          <ChipIntencion intencion={intencion} />
        </div>
      ) : null}
      <ActividadHerramientas actividades={actividades} />
      {texto ? (
        <Markdown
          texto={texto}
          conCitas={grupos.length > 0}
          alCitar={alCitar}
        />
      ) : null}
      {grupos.map((grupo, indice) =>
        indice === 0 ? (
          <PanelFuentes
            key={indice}
            resultados={grupo}
            prefijo={`${prefijo}0`}
            abierto={abierto}
            onAlternar={() => setAbierto((previo) => !previo)}
            resaltada={resaltada}
          />
        ) : (
          <PanelFuentes
            key={indice}
            resultados={grupo}
            prefijo={`${prefijo}${indice}`}
          />
        ),
      )}
      {propuestas.map((propuesta) => (
        <TarjetaPropuesta key={propuesta.propuesta_id} propuesta={propuesta} />
      ))}
      {completo && texto ? (
        <div className="mt-3 -mb-1 flex items-center gap-1">
          <BotonCopiar texto={texto} />
        </div>
      ) : null}
    </div>
  );
}
