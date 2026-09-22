"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import {
  indicadorDePartes,
  MensajeAsistente,
  type ParteVista,
} from "@/components/mensaje-asistente";

const USUARIOS = [
  { id: "coordinadora_enfermeria", etiqueta: "Coordinadora de enfermería" },
  { id: "jefe_vigilancia", etiqueta: "Jefe de vigilancia" },
  { id: "gerencia", etiqueta: "Gerencia" },
] as const;

const CLAVE_USUARIO = "relevo.usuario";
const CLAVE_CONVERSACION = "relevo.conversacion_id";

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

function partesVista(mensaje: UIMessage): ParteVista[] {
  return mensaje.parts.map((parte) => {
    const suelto = parte as ParteVista;
    return {
      type: suelto.type,
      text: suelto.text,
      state: suelto.state,
      toolName: suelto.toolName,
      data: suelto.data,
      output: suelto.output,
    };
  });
}

export function Chat() {
  const [entrada, setEntrada] = useState("");
  const [usuario, setUsuario] = useState<string>(USUARIOS[0].id);
  const usuarioRef = useRef(usuario);
  const convRef = useRef<string | null>(null);
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          usuario: usuarioRef.current,
          conversacion_id: convRef.current,
        },
      }),
    }),
  );
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: transport.current,
  });

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_USUARIO);
    if (guardado && USUARIOS.some((item) => item.id === guardado)) {
      usuarioRef.current = guardado;
      setUsuario(guardado);
    }
    const conversacion = window.localStorage.getItem(CLAVE_CONVERSACION);
    if (conversacion && !convRef.current) {
      convRef.current = conversacion;
      void cargarHistorial(conversacion, usuarioRef.current, setMessages);
    }
  }, [setMessages]);

  function cambiarUsuario(siguiente: string) {
    usuarioRef.current = siguiente;
    setUsuario(siguiente);
    const nueva = crypto.randomUUID();
    convRef.current = nueva;
    window.localStorage.setItem(CLAVE_USUARIO, siguiente);
    window.localStorage.setItem(CLAVE_CONVERSACION, nueva);
    setMessages([]);
  }

  const ocupado = status === "submitted" || status === "streaming";
  const hayAvisoEnMensaje = messages.some(
    (mensaje) =>
      mensaje.role === "assistant" &&
      indicadorDePartes(partesVista(mensaje)) !== null,
  );

  function enviar(texto: string) {
    const recorte = texto.trim();
    if (!recorte || ocupado) {
      return;
    }
    if (!convRef.current) {
      convRef.current = crypto.randomUUID();
      window.localStorage.setItem(CLAVE_CONVERSACION, convRef.current);
    }
    window.localStorage.setItem(CLAVE_USUARIO, usuarioRef.current);
    sendMessage({ text: recorte });
    setEntrada("");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6">
      <header className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relevo</h1>
          <p className="mt-1 text-sm text-stone-500">
            Asistente de turnos y ausencias
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-500">
          <span>Usuario</span>
          <select
            aria-label="Usuario"
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700"
            value={usuario}
            disabled={ocupado}
            onChange={(evento) => cambiarUsuario(evento.target.value)}
          >
            {USUARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </label>
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
                      : "mr-auto w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800"
                  }
                >
                  {esUsuario ? (
                    textoDeMensaje(mensaje)
                  ) : (
                    <MensajeAsistente parts={partesVista(mensaje)} />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {ocupado && !hayAvisoEnMensaje ? (
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

async function cargarHistorial(
  conversacionId: string,
  usuarioActual: string,
  setMessages: (mensajes: UIMessage[]) => void,
): Promise<void> {
  try {
    const respuesta = await fetch(
      `/api/chat?conversacion_id=${conversacionId}&usuario=${encodeURIComponent(usuarioActual)}`,
    );
    if (!respuesta.ok) {
      return;
    }
    const datos = (await respuesta.json()) as {
      mensajes?: { rol?: string; parts?: { type?: string; text?: string }[] }[];
    };
    if (!Array.isArray(datos.mensajes) || datos.mensajes.length === 0) {
      return;
    }
    setMessages(
      datos.mensajes.flatMap((mensaje, indice) => {
        const rol = mensaje.rol === "assistant" ? "assistant" : "user";
        const texto = (mensaje.parts ?? [])
          .filter((parte) => parte.type === "text")
          .map((parte) => parte.text ?? "")
          .join("\n");
        if (texto.length === 0) {
          return [];
        }
        return [
          {
            id: `hist-${indice}`,
            role: rol,
            parts: [{ type: "text" as const, text: texto }],
          },
        ];
      }),
    );
  } catch {
    // El siguiente turno igual recupera el historial en el servidor.
  }
}
