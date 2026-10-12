"use client";

import { PanelLeftClose, Search, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  agruparHistorial,
  filtrarHistorial,
  type ConversacionResumen,
} from "@/lib/ui/agrupar-historial";
import { Historial } from "./historial";
import { Marca } from "./marca";
import { TarjetaPerfil } from "./tarjeta-perfil";

export function BarraLateral({
  cerrada,
  conversaciones,
  cargando,
  activaId,
  usuario,
  ocupado,
  enfocarBusqueda,
  onCerrar,
  onNueva,
  onSeleccionar,
  onEliminar,
  onCambiarUsuario,
}: {
  cerrada: boolean;
  conversaciones: ConversacionResumen[];
  cargando: boolean;
  activaId: string | null;
  usuario: string;
  ocupado: boolean;
  /** Cambia cada vez que se pide enfocar la búsqueda (Ctrl+K). */
  enfocarBusqueda: number;
  onCerrar: () => void;
  onNueva: () => void;
  onSeleccionar: (id: string) => void;
  onEliminar: (id: string) => void;
  onCambiarUsuario: (id: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (enfocarBusqueda > 0) {
      campo.current?.focus();
      campo.current?.select();
    }
  }, [enfocarBusqueda]);

  const grupos = useMemo(
    () => agruparHistorial(filtrarHistorial(conversaciones, busqueda)),
    [conversaciones, busqueda],
  );

  return (
    <aside
      aria-label="Barra lateral"
      inert={cerrada}
      className={`fixed inset-y-0 left-0 z-40 flex w-[84vw] max-w-[300px] flex-col border-r border-line bg-sand shadow-elevada transition-transform duration-200 ease-out md:static md:z-auto md:w-[272px] md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none md:transition-[margin] ${
        cerrada ? "-translate-x-full md:-ml-[272px]" : "translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Marca />
          <span className="text-[19px] font-bold tracking-tight text-ink">
            Relevo
          </span>
        </div>
        <button
          type="button"
          aria-label="Cerrar barra lateral"
          className="rounded-md p-1.5 text-muted hover:bg-cream"
          onClick={onCerrar}
        >
          <span className="md:hidden">
            <X size={18} aria-hidden="true" />
          </span>
          <span className="hidden md:inline">
            <PanelLeftClose size={18} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-boton bg-deep px-3 py-2.5 text-sm font-semibold text-white shadow-suave transition-colors hover:bg-ink"
          onClick={onNueva}
        >
          <SquarePen size={16} aria-hidden="true" />
          Nueva conversación
        </button>
        <label className="relative mt-3 block">
          <span className="sr-only">Buscar conversaciones</span>
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
          />
          <input
            ref={campo}
            type="search"
            value={busqueda}
            placeholder="Buscar"
            autoComplete="off"
            className="w-full rounded-boton border border-line bg-surface py-2 pr-12 pl-9 text-[13.5px] text-ink placeholder:text-subtle"
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          {busqueda.length === 0 ? (
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line bg-cream px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-subtle md:block">
              Ctrl K
            </kbd>
          ) : null}
        </label>
      </div>

      <div className="scroll-fino mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <Historial
          grupos={grupos}
          activaId={activaId}
          cargando={cargando}
          hayBusqueda={busqueda.trim().length > 0}
          onSeleccionar={onSeleccionar}
          onEliminar={onEliminar}
        />
      </div>

      <div className="border-t border-line p-3">
        <TarjetaPerfil
          usuario={usuario}
          deshabilitado={ocupado}
          onCambiar={onCambiarUsuario}
        />
      </div>
    </aside>
  );
}
