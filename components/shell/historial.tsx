"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { GrupoHistorial } from "@/lib/ui/agrupar-historial";

export function Historial({
  grupos,
  activaId,
  cargando,
  hayBusqueda,
  onSeleccionar,
  onEliminar,
}: {
  grupos: GrupoHistorial[];
  activaId: string | null;
  cargando: boolean;
  hayBusqueda: boolean;
  onSeleccionar: (id: string) => void;
  onEliminar: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null);

  if (grupos.length === 0) {
    return (
      <p className="px-3 py-4 text-[13px] text-subtle">
        {cargando
          ? "Cargando historial…"
          : hayBusqueda
            ? "Sin resultados para tu búsqueda."
            : "Aún no hay conversaciones. Empieza con una pregunta."}
      </p>
    );
  }

  return (
    <nav aria-label="Historial de conversaciones" className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <section key={grupo.etiqueta} aria-label={grupo.etiqueta}>
          <h2 className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-subtle">
            {grupo.etiqueta}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {grupo.conversaciones.map((conversacion) => {
              const activa = conversacion.id === activaId;
              if (confirmando === conversacion.id) {
                return (
                  <li
                    key={conversacion.id}
                    className="flex items-center justify-between gap-2 rounded-fila bg-danger-tint px-3 py-1.5 text-[13px] text-danger"
                  >
                    <span className="font-medium">¿Eliminar?</span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-md px-2 py-0.5 font-semibold hover:bg-white/70"
                        onClick={() => {
                          setConfirmando(null);
                          onEliminar(conversacion.id);
                        }}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-0.5 font-medium text-muted hover:bg-white/70"
                        onClick={() => setConfirmando(null)}
                      >
                        No
                      </button>
                    </span>
                  </li>
                );
              }
              return (
                <li
                  key={conversacion.id}
                  className={`group relative flex items-center rounded-fila transition-colors ${
                    activa ? "bg-primary-tint" : "hover:bg-cream"
                  }`}
                >
                  <button
                    type="button"
                    aria-current={activa ? "true" : undefined}
                    title={conversacion.titulo}
                    className={`min-w-0 flex-1 truncate rounded-fila px-3 py-2 text-left text-[13.5px] ${
                      activa ? "font-semibold text-primary" : "text-ink"
                    }`}
                    onClick={() => onSeleccionar(conversacion.id)}
                  >
                    {conversacion.titulo}
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar «${conversacion.titulo}»`}
                    className="mr-1 shrink-0 rounded-md p-1.5 text-subtle opacity-0 transition-opacity hover:bg-white hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    onClick={() => setConfirmando(conversacion.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
