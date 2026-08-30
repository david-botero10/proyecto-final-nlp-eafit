"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState } from "react";

const EJEMPLOS = [
  "¿Quién cubre el turno de la noche el sábado?",
  "¿Cuánto es el recargo nocturno?",
  "Ponle el de la mañana a Ana toda la otra semana",
] as const;

function textoDeMensaje(mensaje: UIMessage): string {
  return mensaje.parts
    .filter((parte) => parte.type === "text")
    .map((parte) => parte.text)
    .join("");
}

export function Chat() {
  const [entrada, setEntrada] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const ocupado = status === "submitted" || status === "streaming";

  function enviar(texto: string) {
    const recorte = texto.trim();
    if (!recorte || ocupado) {
      return;
    }
    sendMessage({ text: recorte });
    setEntrada("");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6">
      <header className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Relevo</h1>
        <p className="mt-1 text-sm text-stone-500">
          Asistente de turnos y ausencias
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-4">
            <p className="text-sm text-stone-500">
              Empieza con una pregunta o una orden. Por ejemplo:
            </p>
            <ul className="flex flex-col gap-2">
              {EJEMPLOS.map((ejemplo) => (
                <li key={ejemplo}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-left text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-100"
                    onClick={() => enviar(ejemplo)}
                  >
                    {ejemplo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-1 flex-col gap-3">
            {messages.map((mensaje) => {
              const esUsuario = mensaje.role === "user";
              return (
                <li
                  key={mensaje.id}
                  className={
                    esUsuario
                      ? "ml-auto max-w-[85%] rounded-2xl bg-stone-800 px-4 py-3 text-sm text-white"
                      : "mr-auto max-w-[85%] rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800"
                  }
                >
                  {textoDeMensaje(mensaje)}
                </li>
              );
            })}
          </ol>
        )}

        {ocupado ? (
          <p className="text-sm text-stone-500" aria-live="polite">
            pensando
          </p>
        ) : null}
      </main>

      <form
        className="flex gap-2 border-t border-stone-200 pt-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar(entrada);
        }}
      >
        <input
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
          value={entrada}
          onChange={(evento) => setEntrada(evento.target.value)}
          placeholder="Escribe una orden o pregunta…"
          disabled={ocupado}
        />
        <button
          type="submit"
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={ocupado || entrada.trim().length === 0}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
