"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { BarraLateral } from "@/components/shell/barra-lateral";
import { BarraSuperior } from "@/components/shell/barra-superior";
import { useHistorial } from "@/lib/ui/use-historial";
import {
  CLAVE_CONVERSACION,
  CLAVE_USUARIO,
  USUARIOS,
  esUsuarioConocido,
  perfilPorId,
} from "@/lib/ui/perfiles";
import type { Propuesta } from "@/lib/tipos";
import { Bienvenida } from "./bienvenida";
import { Compositor } from "./compositor";
import { Hilo, partesVista, textoDeMensaje } from "./hilo";
import { indicadorDePartes } from "./mensaje-asistente";

const CONSULTA_ESCRITORIO = "(min-width: 768px)";
const TITULO_NUEVA = "Nueva conversación";

function suscribirEscritorio(avisar: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const lista = window.matchMedia(CONSULTA_ESCRITORIO);
  lista.addEventListener("change", avisar);
  return () => lista.removeEventListener("change", avisar);
}

function esEscritorioAhora(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(CONSULTA_ESCRITORIO).matches
    : true;
}

/** True cuando todavía no hay nada visible que mostrar del turno en curso. */
function sinContenidoVisible(mensajes: UIMessage[]): boolean {
  const ultimo = mensajes[mensajes.length - 1];
  if (!ultimo || ultimo.role === "user") {
    return true;
  }
  const partes = partesVista(ultimo);
  const hayTexto = partes.some(
    (parte) => parte.type === "text" && (parte.text ?? "").length > 0,
  );
  return !hayTexto && indicadorDePartes(partes) === null;
}

export function Chat() {
  const [entrada, setEntrada] = useState("");
  const [usuario, setUsuario] = useState<string>(USUARIOS[0].id);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [colapsada, setColapsada] = useState(false);
  const [enfocarBusqueda, setEnfocarBusqueda] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(false);
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
  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: transport.current,
  });
  const historial = useHistorial(usuario);
  const esEscritorio = useSyncExternalStore(
    suscribirEscritorio,
    esEscritorioAhora,
    () => true,
  );

  const ocupado = status === "submitted" || status === "streaming";
  const cerrada = esEscritorio ? colapsada : !drawerAbierto;

  const fijarConversacion = useCallback((id: string | null) => {
    convRef.current = id;
    setConversacionId(id);
    if (id) {
      window.localStorage.setItem(CLAVE_CONVERSACION, id);
    }
  }, []);

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_USUARIO);
    if (guardado && esUsuarioConocido(guardado)) {
      usuarioRef.current = guardado;
      setUsuario(guardado);
    }
    const conversacion = window.localStorage.getItem(CLAVE_CONVERSACION);
    if (conversacion && !convRef.current) {
      convRef.current = conversacion;
      setConversacionId(conversacion);
      void restaurar(conversacion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El historial lateral se actualiza al terminar cada turno.
  const estabaOcupado = useRef(false);
  const { refrescar } = historial;
  useEffect(() => {
    if (estabaOcupado.current && !ocupado) {
      void refrescar();
    }
    estabaOcupado.current = ocupado;
  }, [ocupado, refrescar]);

  useEffect(() => {
    if (!aviso) {
      return;
    }
    const temporizador = window.setTimeout(() => setAviso(null), 3200);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setColapsada(false);
        setDrawerAbierto(true);
        window.setTimeout(() => setEnfocarBusqueda((previo) => previo + 1), 60);
      } else if (evento.key === "Escape") {
        setDrawerAbierto(false);
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  async function restaurar(id: string) {
    setRestaurando(true);
    try {
      await cargarHistorial(id, usuarioRef.current, setMessages);
    } finally {
      setRestaurando(false);
    }
  }

  function cambiarUsuario(siguiente: string) {
    stop();
    usuarioRef.current = siguiente;
    setUsuario(siguiente);
    const nueva = crypto.randomUUID();
    fijarConversacion(nueva);
    window.localStorage.setItem(CLAVE_USUARIO, siguiente);
    setMessages([]);
    setEntrada("");
    setDrawerAbierto(false);
  }

  function nuevaConversacion() {
    stop();
    fijarConversacion(crypto.randomUUID());
    setMessages([]);
    setEntrada("");
    setDrawerAbierto(false);
  }

  function seleccionar(id: string) {
    setDrawerAbierto(false);
    if (id === convRef.current && messages.length > 0) {
      return;
    }
    stop();
    fijarConversacion(id);
    setMessages([]);
    setEntrada("");
    void restaurar(id);
  }

  async function eliminar(id: string) {
    const eliminada = await historial.eliminar(id);
    if (!eliminada) {
      setAviso("No se pudo eliminar la conversación");
      return;
    }
    setAviso("Conversación eliminada");
    if (id === convRef.current) {
      nuevaConversacion();
    }
  }

  function enviar(texto: string) {
    const recorte = texto.trim();
    if (!recorte || ocupado) {
      return;
    }
    if (!convRef.current) {
      fijarConversacion(crypto.randomUUID());
    }
    window.localStorage.setItem(CLAVE_USUARIO, usuarioRef.current);
    sendMessage({ text: recorte });
    setEntrada("");
  }

  const perfil = perfilPorId(usuario);
  const vacio = messages.length === 0;
  const resumenActivo = historial.conversaciones.find(
    (conversacion) => conversacion.id === conversacionId,
  );
  const primerTexto = messages.find((mensaje) => mensaje.role === "user");
  const titulo = vacio
    ? TITULO_NUEVA
    : (resumenActivo?.titulo ??
      (primerTexto ? textoDeMensaje(primerTexto).slice(0, 60) : TITULO_NUEVA));

  const compositor = (
    <Compositor
      valor={entrada}
      ocupado={ocupado}
      onCambio={setEntrada}
      onEnviar={() => enviar(entrada)}
      onDetener={() => stop()}
    />
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-cream">
      {drawerAbierto && !esEscritorio ? (
        <button
          type="button"
          aria-label="Cerrar barra lateral"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={() => setDrawerAbierto(false)}
        />
      ) : null}

      <BarraLateral
        cerrada={cerrada}
        conversaciones={historial.conversaciones}
        cargando={historial.cargando}
        activaId={conversacionId}
        usuario={usuario}
        ocupado={ocupado}
        enfocarBusqueda={enfocarBusqueda}
        onCerrar={() => {
          setDrawerAbierto(false);
          setColapsada(true);
        }}
        onNueva={nuevaConversacion}
        onSeleccionar={seleccionar}
        onEliminar={(id) => void eliminar(id)}
        onCambiarUsuario={cambiarUsuario}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior
          titulo={titulo}
          mostrarMenu={colapsada}
          onAbrirMenu={() => {
            setColapsada(false);
            setDrawerAbierto(true);
          }}
        />
        <main className="flex min-h-0 flex-1 flex-col">
          {vacio && restaurando ? (
            <div
              role="status"
              className="flex min-h-0 flex-1 items-center justify-center text-sm text-subtle"
            >
              Abriendo la conversación…
            </div>
          ) : vacio ? (
            <div className="scroll-fino min-h-0 flex-1 overflow-y-auto">
              <Bienvenida
                perfil={perfil}
                compositor={compositor}
                onElegir={enviar}
              />
            </div>
          ) : (
            <>
              <Hilo
                mensajes={messages}
                ocupado={ocupado}
                mostrarPensando={ocupado && sinContenidoVisible(messages)}
                claveConversacion={conversacionId}
              />
              <div className="px-4 pt-1 pb-3">
                <div className="mx-auto w-full max-w-[760px]">{compositor}</div>
              </div>
            </>
          )}
        </main>
      </div>

      {aviso ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-aparecer rounded-boton bg-deep px-4 py-2.5 text-sm font-medium text-white shadow-elevada"
        >
          {aviso}
        </div>
      ) : null}
    </div>
  );
}

type MensajeGuardadoApi = {
  rol?: string;
  parts?: { type?: string; text?: string; propuesta_id?: string }[];
};

function esPropuestaApi(valor: unknown): valor is Propuesta {
  if (!valor || typeof valor !== "object") {
    return false;
  }
  const fila = valor as Partial<Propuesta>;
  return (
    typeof fila.propuesta_id === "string" &&
    typeof fila.orden_texto === "string" &&
    Array.isArray(fila.acciones) &&
    fila.extraccion !== undefined &&
    fila.contexto !== undefined &&
    fila.contexto !== null
  );
}

async function leerPropuesta(id: string): Promise<Propuesta | null> {
  try {
    const respuesta = await fetch(`/api/propuestas/${id}`);
    if (!respuesta.ok) {
      return null;
    }
    const datos: unknown = await respuesta.json();
    return esPropuestaApi(datos) ? datos : null;
  } catch {
    return null;
  }
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
    const datos = (await respuesta.json()) as { mensajes?: MensajeGuardadoApi[] };
    if (!Array.isArray(datos.mensajes) || datos.mensajes.length === 0) {
      return;
    }
    const restaurados = await Promise.all(
      datos.mensajes.map(async (mensaje, indice): Promise<UIMessage[]> => {
        const rol = mensaje.rol === "assistant" ? "assistant" : "user";
        const partes = mensaje.parts ?? [];
        const texto = partes
          .filter((parte) => parte.type === "text")
          .map((parte) => parte.text ?? "")
          .join("\n");
        // Las tarjetas guardadas se vuelven a leer: muestran su estado actual.
        const tarjetas =
          rol === "assistant"
            ? (
                await Promise.all(
                  partes
                    .filter(
                      (parte) =>
                        parte.type === "propuesta" &&
                        typeof parte.propuesta_id === "string",
                    )
                    .map((parte) => leerPropuesta(parte.propuesta_id as string)),
                )
              ).flatMap((propuesta) => (propuesta ? [propuesta] : []))
            : [];
        if (texto.length === 0 && tarjetas.length === 0) {
          return [];
        }
        return [
          {
            id: `hist-${indice}`,
            role: rol,
            parts: [
              ...(texto.length > 0
                ? [{ type: "text" as const, text: texto }]
                : []),
              ...tarjetas.map((propuesta) => ({
                type: "data-propuesta" as const,
                id: propuesta.propuesta_id,
                data: propuesta,
              })),
            ],
          } as UIMessage,
        ];
      }),
    );
    if (convActualCambio(conversacionId)) {
      return;
    }
    setMessages(restaurados.flat());
  } catch {
    // El siguiente turno igual recupera el historial en el servidor.
  }
}

function convActualCambio(conversacionId: string): boolean {
  return window.localStorage.getItem(CLAVE_CONVERSACION) !== conversacionId;
}
