"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

const ALTURA_MAXIMA = 200;

export function Compositor({
  valor,
  ocupado,
  onCambio,
  onEnviar,
  onDetener,
}: {
  valor: string;
  ocupado: boolean;
  onCambio: (texto: string) => void;
  onEnviar: () => void;
  onDetener: () => void;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const elemento = campo.current;
    if (!elemento) {
      return;
    }
    elemento.style.height = "auto";
    elemento.style.height = `${Math.min(elemento.scrollHeight, ALTURA_MAXIMA)}px`;
  }, [valor]);

  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      evento.key === "Enter" &&
      !evento.shiftKey &&
      !evento.nativeEvent.isComposing
    ) {
      evento.preventDefault();
      onEnviar();
    }
  }

  const vacio = valor.trim().length === 0;

  return (
    <div className="w-full">
      <form
        className="flex items-end gap-2 rounded-compositor border border-line bg-surface p-2.5 pl-4 shadow-elevada transition-shadow focus-within:border-primary focus-within:shadow-[var(--halo)]"
        onSubmit={(evento) => {
          evento.preventDefault();
          onEnviar();
        }}
      >
        <textarea
          ref={campo}
          rows={1}
          value={valor}
          aria-label="Mensaje"
          placeholder="Escribe una orden o pregunta…"
          className="scroll-fino max-h-[200px] min-h-[28px] flex-1 resize-none self-center bg-transparent py-1 text-[15px] leading-relaxed text-ink placeholder:text-subtle focus-visible:!shadow-none"
          onChange={(evento) => onCambio(evento.target.value)}
          onKeyDown={alTeclear}
        />
        {ocupado ? (
          <button
            type="button"
            aria-label="Detener"
            title="Detener la respuesta"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-deep text-white transition-colors hover:bg-ink"
            onClick={onDetener}
          >
            <Square size={14} fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Enviar"
            title="Enviar (Enter)"
            disabled={vacio}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-sand disabled:text-subtle"
          >
            <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </form>
      <p className="mt-2 text-center text-xs text-subtle">
        Relevo consulta por su cuenta; nada se escribe en la nómina sin tu
        aprobación.
      </p>
    </div>
  );
}
