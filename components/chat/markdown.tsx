"use client";

import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const CITA = /\[(\d{1,2})\](?![(\[:])/g;

/** Convierte los marcadores [n] en enlaces internos para pintarlos como chips. */
export function conMarcadoresDeCita(texto: string): string {
  return texto.replace(CITA, (_coincidencia, n: string) => `[\\[${n}\\]](#cita-${n})`);
}

export type AlCitar = (numero: number) => void;

function componentes(alCitar: AlCitar | undefined): Components {
  return {
    a({ href, children }) {
      const cita = href?.match(/^#cita-(\d+)$/);
      if (cita) {
        const numero = Number(cita[1]);
        return (
          <button
            type="button"
            data-cita={numero}
            title={`Ver fuente ${numero}`}
            aria-label={`Ver fuente ${numero}`}
            className="ml-0.5 inline-flex -translate-y-[0.18em] items-center rounded-md bg-primary-tint px-1 py-px align-baseline text-[0.72em] leading-none font-semibold text-primary hover:bg-primary hover:text-white"
            onClick={() => alCitar?.(numero)}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    table({ children }): ReactNode {
      return (
        <div className="tabla-envoltura">
          <table>{children}</table>
        </div>
      );
    },
  };
}

function MarkdownBase({
  texto,
  conCitas = false,
  alCitar,
}: {
  texto: string;
  /** Solo se pintan chips cuando hay fuentes a las que apuntar. */
  conCitas?: boolean;
  alCitar?: AlCitar;
}) {
  const fuente = useMemo(
    () => (conCitas ? conMarcadoresDeCita(texto) : texto),
    [texto, conCitas],
  );
  const mapa = useMemo(() => componentes(alCitar), [alCitar]);
  return (
    <div className="markdown text-[15px] text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mapa}>
        {fuente}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownBase);
