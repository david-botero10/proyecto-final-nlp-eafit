"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { USUARIOS, perfilPorId } from "@/lib/ui/perfiles";

export function TarjetaPerfil({
  usuario,
  deshabilitado,
  onCambiar,
}: {
  usuario: string;
  deshabilitado: boolean;
  onCambiar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const perfil = perfilPorId(usuario);

  useEffect(() => {
    if (!abierto) {
      return;
    }
    function alPulsar(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    function alTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
      }
    }
    document.addEventListener("pointerdown", alPulsar);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("pointerdown", alPulsar);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      {abierto ? (
        <ul
          role="menu"
          aria-label="Cambiar de perfil"
          className="absolute inset-x-0 bottom-full mb-2 animate-aparecer rounded-tarjeta border border-line bg-surface p-1.5 shadow-elevada"
        >
          {USUARIOS.map((item) => {
            const activo = item.id === usuario;
            return (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={activo}
                  className="flex w-full items-center gap-3 rounded-fila px-2.5 py-2 text-left hover:bg-cream"
                  onClick={() => {
                    setAbierto(false);
                    if (!activo) {
                      onCambiar(item.id);
                    }
                  }}
                >
                  <Avatar iniciales={item.iniciales} activo={activo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">
                      {item.etiqueta}
                    </span>
                    <span className="block truncate text-xs text-subtle">
                      {item.alcance}
                    </span>
                  </span>
                  {activo ? (
                    <Check size={16} aria-hidden="true" className="text-primary" />
                  ) : null}
                </button>
              </li>
            );
          })}
          <li
            role="none"
            className="mt-1 border-t border-line px-2.5 pt-2 pb-1 text-[11.5px] leading-snug text-subtle"
          >
            Cambiar de perfil empieza una conversación nueva.
          </li>
        </ul>
      ) : null}
      <button
        type="button"
        aria-label={`Perfil: ${perfil.etiqueta}. Cambiar de perfil`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        disabled={deshabilitado}
        className="flex w-full items-center gap-3 rounded-tarjeta border border-line bg-surface px-3 py-2.5 text-left shadow-suave transition-colors hover:border-subtle/50 disabled:opacity-60"
        onClick={() => setAbierto((previo) => !previo)}
      >
        <Avatar iniciales={perfil.iniciales} activo />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">
            {perfil.etiqueta}
          </span>
          <span className="block truncate text-xs text-subtle">
            {perfil.alcance}
          </span>
        </span>
        <ChevronsUpDown size={16} aria-hidden="true" className="shrink-0 text-subtle" />
      </button>
    </div>
  );
}

function Avatar({ iniciales, activo }: { iniciales: string; activo: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        activo ? "bg-deep text-white" : "bg-sand text-muted"
      }`}
    >
      {iniciales}
    </span>
  );
}
