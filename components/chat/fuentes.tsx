"use client";

import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";

export type ResultadoFuente = {
  chunk_id: number;
  ref: string | null;
  fuente: string;
  titulo: string;
  url: string | null;
  fragmento: string;
  score: number;
};

function hrefSeguro(url: string | null): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url;
  }
  return null;
}

export function idFuente(prefijo: string, numero: number): string {
  return `fuente-${prefijo}-${numero}`;
}

export function PanelFuentes({
  resultados,
  prefijo = "f",
  abierto,
  onAlternar,
  resaltada = null,
}: {
  resultados: ResultadoFuente[];
  prefijo?: string;
  /** Si se omite, el panel maneja su propio estado (plegado al inicio). */
  abierto?: boolean;
  onAlternar?: () => void;
  /** Número (desde 1) de la fuente a resaltar. */
  resaltada?: number | null;
}) {
  const [propio, setPropio] = useState(false);
  if (resultados.length === 0) {
    return null;
  }
  const estaAbierto = abierto ?? propio;
  const alternar = onAlternar ?? (() => setPropio((previo) => !previo));
  const idLista = `lista-${prefijo}`;
  const etiqueta = `${resultados.length} ${resultados.length === 1 ? "fuente" : "fuentes"}`;

  return (
    <section aria-label="Fuentes" className="mt-4 border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={estaAbierto}
        aria-controls={idLista}
        className="inline-flex items-center gap-2 rounded-fila px-2 py-1 text-[13px] font-semibold text-muted hover:bg-sand"
        onClick={alternar}
      >
        <BookOpen size={16} aria-hidden="true" className="text-primary" />
        {etiqueta}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform ${estaAbierto ? "rotate-180" : ""}`}
        />
      </button>
      <ol
        id={idLista}
        hidden={!estaAbierto}
        className="mt-2 flex flex-col gap-1.5"
      >
        {resultados.map((resultado, indice) => {
          const numero = indice + 1;
          const href = hrefSeguro(resultado.url);
          const activa = resaltada === numero;
          return (
            <li
              key={`${resultado.chunk_id}-${indice}`}
              id={idFuente(prefijo, numero)}
              className={`flex items-start gap-3 rounded-fila border px-3 py-2 text-[13px] transition-colors duration-500 ${
                activa
                  ? "border-primary bg-primary-tint"
                  : "border-line bg-cream/60"
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary-tint text-[11px] font-bold text-primary"
              >
                {numero}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink">{resultado.fuente}</span>
                {resultado.ref ? (
                  <span className="text-muted"> · {resultado.ref}</span>
                ) : null}
                <span className="block text-muted">
                  {href ? (
                    <a
                      href={href}
                      className="inline-flex items-center gap-1 text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resultado.titulo}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : (
                    resultado.titulo
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
