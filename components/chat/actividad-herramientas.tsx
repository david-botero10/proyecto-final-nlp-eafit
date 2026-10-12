"use client";

import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CalendarOff,
  Check,
  ChevronDown,
  ClipboardPen,
  Loader2,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { ActividadHerramienta } from "@/lib/ui/herramientas";

const ICONOS: Record<string, LucideIcon> = {
  buscar_norma: BookOpen,
  listar_empleados: Users,
  consultar_turnos: CalendarClock,
  consultar_ausencias: CalendarOff,
  crear_propuesta: ClipboardPen,
};

function Fila({ actividad }: { actividad: ActividadHerramienta }) {
  const [abierta, setAbierta] = useState(false);
  const Icono = ICONOS[actividad.nombre] ?? Wrench;
  const hayDetalle =
    actividad.estado !== "ejecutando" &&
    (actividad.resultado !== null || actividad.entrada.length > 0);

  return (
    <li className="rounded-fila border border-line bg-cream/60 text-[13px]">
      <button
        type="button"
        aria-expanded={hayDetalle ? abierta : undefined}
        disabled={!hayDetalle}
        className="flex w-full items-center gap-2.5 rounded-fila px-3 py-1.5 text-left disabled:cursor-default"
        onClick={() => setAbierta((previo) => !previo)}
      >
        <Icono size={16} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-muted">
          {actividad.etiqueta}
        </span>
        {actividad.resultado ? (
          <span className="hidden shrink-0 text-xs text-subtle sm:inline">
            {actividad.resultado}
          </span>
        ) : null}
        {actividad.estado === "ejecutando" ? (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-1.5 animate-pulso-suave rounded-full bg-amber"
            />
            <Loader2
              size={14}
              aria-label="En curso"
              className="animate-spin text-amber"
            />
          </span>
        ) : actividad.estado === "error" ? (
          <AlertCircle
            size={15}
            aria-label="Falló"
            className="shrink-0 text-danger"
          />
        ) : (
          <Check
            size={15}
            aria-label="Listo"
            className="shrink-0 text-success"
          />
        )}
        {hayDetalle ? (
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`shrink-0 text-subtle transition-transform ${abierta ? "rotate-180" : ""}`}
          />
        ) : null}
      </button>
      {hayDetalle && abierta ? (
        <dl className="border-t border-line px-3 py-2 text-xs text-muted">
          {actividad.resultado ? (
            <div className="flex gap-2">
              <dt className="font-semibold">Resultado</dt>
              <dd>{actividad.resultado}</dd>
            </div>
          ) : null}
          {actividad.entrada.map((par) => (
            <div key={par.clave} className="flex gap-2">
              <dt className="font-semibold">{par.clave}</dt>
              <dd className="min-w-0 break-words">{par.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

/** Carril de actividad: muestra qué consultó el agente antes de responder. */
export function ActividadHerramientas({
  actividades,
}: {
  actividades: ActividadHerramienta[];
}) {
  if (actividades.length === 0) {
    return null;
  }
  return (
    <ul
      aria-label="Actividad del asistente"
      aria-live="polite"
      className="mb-3 flex flex-col gap-1.5"
    >
      {actividades.map((actividad, indice) => (
        <Fila key={`${actividad.nombre}-${indice}`} actividad={actividad} />
      ))}
    </ul>
  );
}
