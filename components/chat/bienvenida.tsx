"use client";

import {
  BookOpen,
  CalendarClock,
  CalendarOff,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  SUGERENCIAS,
  saludoDeLaHora,
  type PerfilUi,
  type Sugerencia,
} from "@/lib/ui/perfiles";

const ICONOS: Record<Sugerencia["categoria"], LucideIcon> = {
  Norma: BookOpen,
  Turnos: CalendarClock,
  Orden: PenLine,
  Ausencias: CalendarOff,
};

const TONOS: Record<Sugerencia["categoria"], string> = {
  Norma: "bg-primary-tint text-primary",
  Turnos: "bg-primary-tint text-primary",
  Orden: "bg-amber-tint text-amber-ink",
  Ausencias: "bg-sand text-muted",
};

export function Bienvenida({
  perfil,
  compositor,
  onElegir,
}: {
  perfil: PerfilUi;
  compositor: ReactNode;
  onElegir: (pregunta: string) => void;
}) {
  // La hora se calcula en el cliente para no desajustar la hidratación.
  const [saludo, setSaludo] = useState("Hola");
  useEffect(() => {
    setSaludo(saludoDeLaHora(new Date()));
  }, []);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center px-4 py-10">
      <div className="mb-7 text-center">
        <h2 className="text-[28px] leading-tight font-bold tracking-tight text-ink sm:text-[34px]">
          {saludo}, {perfil.etiqueta}
        </h2>
        <p className="mx-auto mt-2.5 max-w-[520px] text-[15px] leading-relaxed text-muted">
          Relevo consulta turnos, ausencias y la norma laboral por ti, y
          prepara cambios para que los apruebes.
        </p>
      </div>

      {compositor}

      <ul
        aria-label="Sugerencias"
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {SUGERENCIAS.map((sugerencia) => {
          const Icono = ICONOS[sugerencia.categoria];
          return (
            <li key={sugerencia.pregunta}>
              <button
                type="button"
                className="group flex h-full w-full flex-col gap-2 rounded-tarjeta border border-line bg-surface p-4 text-left shadow-suave transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-elevada"
                onClick={() => onElegir(sugerencia.pregunta)}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-7 items-center justify-center rounded-lg ${TONOS[sugerencia.categoria]}`}
                  >
                    <Icono size={16} />
                  </span>
                  <span className="text-sm font-bold text-ink">
                    {sugerencia.titulo}
                  </span>
                  <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
                    {sugerencia.categoria}
                  </span>
                </span>
                <span className="text-[13.5px] leading-snug text-muted">
                  {sugerencia.pregunta}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
