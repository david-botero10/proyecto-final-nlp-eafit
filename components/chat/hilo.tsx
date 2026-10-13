"use client";

import type { UIMessage } from "ai";
import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MensajeAsistente, type ParteVista } from "./mensaje-asistente";
import { MensajeUsuario } from "./mensaje-usuario";

const UMBRAL_PEGADO = 96;

export function textoDeMensaje(mensaje: UIMessage): string {
  return mensaje.parts
    .filter((parte) => parte.type === "text")
    .map((parte) => parte.text)
    .join("");
}

export function partesVista(mensaje: UIMessage): ParteVista[] {
  return mensaje.parts.map((parte) => {
    const suelto = parte as ParteVista;
    return {
      type: suelto.type,
      text: suelto.text,
      state: suelto.state,
      toolName: suelto.toolName,
      data: suelto.data,
      input: suelto.input,
      output: suelto.output,
      errorText: suelto.errorText,
    };
  });
}

function Pensando() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-1 text-sm text-subtle"
    >
      <span aria-hidden="true" className="flex gap-1">
        {[0, 1, 2].map((punto) => (
          <span
            key={punto}
            className="size-1.5 animate-pulso-suave rounded-full bg-primary"
            style={{ animationDelay: `${punto * 160}ms` }}
          />
        ))}
      </span>
      pensando
    </div>
  );
}

export function Hilo({
  mensajes,
  ocupado,
  mostrarPensando,
  claveConversacion,
}: {
  mensajes: UIMessage[];
  ocupado: boolean;
  mostrarPensando: boolean;
  /** Cambia al abrir otra conversación: vuelve a pegar el scroll al final. */
  claveConversacion: string | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);
  const [mostrarBajar, setMostrarBajar] = useState(false);

  const bajar = useCallback((suave: boolean) => {
    const elemento = contenedor.current;
    if (!elemento) {
      return;
    }
    if (suave && typeof elemento.scrollTo === "function") {
      elemento.scrollTo({ top: elemento.scrollHeight, behavior: "smooth" });
      return;
    }
    elemento.scrollTop = elemento.scrollHeight;
  }, []);

  const alDesplazar = useCallback(() => {
    const elemento = contenedor.current;
    if (!elemento) {
      return;
    }
    const distancia =
      elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight;
    pegado.current = distancia < UMBRAL_PEGADO;
    setMostrarBajar(distancia > UMBRAL_PEGADO * 1.5);
  }, []);

  useEffect(() => {
    pegado.current = true;
    setMostrarBajar(false);
  }, [claveConversacion]);

  const ultimo = mensajes[mensajes.length - 1];
  useLayoutEffect(() => {
    if (ultimo?.role === "user") {
      pegado.current = true;
    }
    if (pegado.current) {
      bajar(false);
    }
  });

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={contenedor}
        onScroll={alDesplazar}
        className="scroll-fino h-full overflow-y-auto"
      >
        <ol className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 py-6">
          {mensajes.map((mensaje, indice) => {
            const esUsuario = mensaje.role === "user";
            const generando =
              ocupado &&
              indice === mensajes.length - 1 &&
              mensaje.role === "assistant";
            return (
              <li key={mensaje.id} className="animate-aparecer">
                {esUsuario ? (
                  <MensajeUsuario texto={textoDeMensaje(mensaje)} />
                ) : (
                  <MensajeAsistente
                    parts={partesVista(mensaje)}
                    completo={!generando}
                  />
                )}
              </li>
            );
          })}
          {mostrarPensando ? (
            <li>
              <Pensando />
            </li>
          ) : null}
        </ol>
      </div>
      {mostrarBajar ? (
        <button
          type="button"
          aria-label="Ir al final de la conversación"
          className="absolute bottom-3 left-1/2 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-elevada hover:text-ink"
          onClick={() => {
            pegado.current = true;
            bajar(true);
          }}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
