"use client";

import { Menu, ShieldCheck } from "lucide-react";

export function BarraSuperior({
  titulo,
  mostrarMenu,
  onAbrirMenu,
}: {
  titulo: string;
  /** En escritorio el botón solo aparece con la barra lateral colapsada. */
  mostrarMenu: boolean;
  onAbrirMenu: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/70 bg-cream/90 px-3 backdrop-blur md:px-5">
      <button
        type="button"
        aria-label="Abrir barra lateral"
        className={`rounded-md p-2 text-muted hover:bg-sand ${
          mostrarMenu ? "" : "md:hidden"
        }`}
        onClick={onAbrirMenu}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <h1
        className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink"
        title={titulo}
      >
        {titulo}
      </h1>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted sm:inline-flex">
        <ShieldCheck size={14} aria-hidden="true" className="text-primary" />
        Consultar es autónomo · escribir exige aprobación
      </span>
    </header>
  );
}
