import type { Sql } from "@/lib/db/cliente";
import type { CuerpoChat } from "@/lib/cuerpo-chat";
import type { ContenidoMensaje, MensajeGuardado, ParteResumen } from "./tipos";

const HISTORIAL = 20;

type FilaMensaje = {
  rol: string;
  contenido: unknown;
};

function partesDe(valor: unknown): ParteResumen[] {
  if (!valor || typeof valor !== "object" || !("parts" in valor)) {
    return [];
  }
  const parts = (valor as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) {
    return [];
  }
  const resumidas: ParteResumen[] = [];
  for (const parte of parts) {
    if (!parte || typeof parte !== "object" || !("type" in parte)) {
      continue;
    }
    const fila = parte as {
      type?: unknown;
      text?: unknown;
      nombre?: unknown;
      propuesta_id?: unknown;
    };
    if (fila.type === "text" && typeof fila.text === "string") {
      resumidas.push({ type: "text", text: fila.text });
    } else if (fila.type === "tool" && typeof fila.nombre === "string") {
      resumidas.push({ type: "tool", nombre: fila.nombre });
    } else if (
      fila.type === "propuesta" &&
      typeof fila.propuesta_id === "string"
    ) {
      resumidas.push({ type: "propuesta", propuesta_id: fila.propuesta_id });
    }
  }
  return resumidas;
}

function textoDePartes(partes: ParteResumen[]): string {
  return partes
    .map((parte) => {
      if (parte.type === "text") {
        return parte.text;
      }
      if (parte.type === "tool") {
        return `[herramienta ${parte.nombre}]`;
      }
      return `[propuesta ${parte.propuesta_id}]`;
    })
    .filter((texto) => texto.length > 0)
    .join("\n");
}

/** True si la conversación existe y es de este usuario. No pisa un hilo ajeno. */
export async function asegurarConversacion(
  sql: Sql,
  conversacionId: string,
  usuario: string,
): Promise<boolean> {
  await sql`
    INSERT INTO conversaciones (id, usuario)
    VALUES (${conversacionId}::uuid, ${usuario})
    ON CONFLICT (id) DO NOTHING
  `;
  const filas = await sql<{ usuario: string }[]>`
    SELECT usuario FROM conversaciones WHERE id = ${conversacionId}::uuid
  `;
  return filas[0]?.usuario === usuario;
}

export async function guardarMensaje(
  sql: Sql,
  conversacionId: string,
  rol: "user" | "assistant",
  contenido: ContenidoMensaje,
): Promise<void> {
  await sql`
    INSERT INTO mensajes (conversacion_id, rol, contenido)
    VALUES (${conversacionId}::uuid, ${rol}, ${sql.json(contenido)})
  `;
}

export async function leerHistorial(
  sql: Sql,
  conversacionId: string,
  usuario: string,
): Promise<MensajeGuardado[]> {
  const filas = await sql<FilaMensaje[]>`
    SELECT rol, contenido
    FROM (
      SELECT m.rol, m.contenido, m.creado_en, m.id
      FROM mensajes m
      JOIN conversaciones c ON c.id = m.conversacion_id
      WHERE c.id = ${conversacionId}::uuid
        AND c.usuario = ${usuario}
        AND m.rol IN ('user', 'assistant')
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT ${HISTORIAL}
    ) recientes
    ORDER BY creado_en ASC, id ASC
  `;
  return filas.flatMap((fila) => {
    if (fila.rol !== "user" && fila.rol !== "assistant") {
      return [];
    }
    return [
      {
        rol: fila.rol,
        contenido: { parts: partesDe(fila.contenido) },
      },
    ];
  });
}

export function historialComoMensajes(
  historial: MensajeGuardado[],
): CuerpoChat["messages"] {
  return historial.map((mensaje, indice) => {
    const texto = textoDePartes(mensaje.contenido.parts);
    return {
      id: `hist-${indice}`,
      role: mensaje.rol,
      parts: [{ type: "text", text: texto.length > 0 ? texto : "(sin texto)" }],
    };
  });
}

/**
 * Si el cliente manda menos mensajes que los ya guardados, el turno usa el historial.
 * El último mensaje del cliente es el turno nuevo y se conserva.
 */
export function mensajesDelTurno(
  cliente: CuerpoChat["messages"],
  historial: CuerpoChat["messages"],
): CuerpoChat["messages"] {
  if (cliente.length === 0) {
    return historial;
  }
  const previos = cliente.length - 1;
  if (historial.length > previos) {
    return [...historial, cliente[cliente.length - 1]];
  }
  return cliente;
}

export async function vincularPropuesta(
  sql: Sql,
  propuestaId: string,
  conversacionId: string,
): Promise<void> {
  await sql`
    UPDATE propuestas
    SET conversacion_id = ${conversacionId}::uuid
    WHERE id = ${propuestaId}::uuid
      AND conversacion_id IS NULL
  `;
}
