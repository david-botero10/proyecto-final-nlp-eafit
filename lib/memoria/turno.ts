import type { CuerpoChat } from "@/lib/cuerpo-chat";
import { crearCliente, type Sql } from "@/lib/db/cliente";
import {
  asegurarConversacion,
  guardarMensaje,
  historialComoMensajes,
  leerHistorial,
  mensajesDelTurno,
} from "./conversaciones";
import { leerPerfil, sembrarPerfilesSiVacio } from "./perfiles";
import type { ContenidoMensaje, Perfil } from "./tipos";

export type TurnoPreparado = {
  mensajes: CuerpoChat["messages"];
  perfil: Perfil | null;
  guardarAsistente: (contenido: ContenidoMensaje) => Promise<void>;
};

async function guardarAsistenteEn(
  conversacionId: string,
  contenido: ContenidoMensaje,
): Promise<void> {
  const cliente = crearCliente();
  try {
    await guardarMensaje(cliente.sql, conversacionId, "assistant", contenido);
  } finally {
    await cliente.cerrar();
  }
}

/** Siembra perfiles, recupera historial y deja guardado el mensaje del usuario. */
export async function prepararTurno(
  sql: Sql,
  datos: {
    usuario: string;
    conversacionId: string | null;
    mensajes: CuerpoChat["messages"];
    textoUsuario: string;
  },
): Promise<TurnoPreparado> {
  await sembrarPerfilesSiVacio(sql);
  const perfil = await leerPerfil(sql, datos.usuario);
  if (!datos.conversacionId) {
    return {
      mensajes: datos.mensajes,
      perfil,
      guardarAsistente: async () => undefined,
    };
  }
  const propia = await asegurarConversacion(
    sql,
    datos.conversacionId,
    datos.usuario,
  );
  if (!propia) {
    return {
      mensajes: datos.mensajes,
      perfil,
      guardarAsistente: async () => undefined,
    };
  }
  const historial = await leerHistorial(
    sql,
    datos.conversacionId,
    datos.usuario,
  );
  const mensajes = mensajesDelTurno(
    datos.mensajes,
    historialComoMensajes(historial),
  );
  await guardarMensaje(sql, datos.conversacionId, "user", {
    parts: [{ type: "text", text: datos.textoUsuario }],
  });
  const conversacionId = datos.conversacionId;
  return {
    mensajes,
    perfil,
    guardarAsistente: (contenido) => guardarAsistenteEn(conversacionId, contenido),
  };
}
