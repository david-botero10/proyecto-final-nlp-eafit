import type { Sql } from "@/lib/db/cliente";
import { PERFILES_SEMILLA, type Perfil } from "./tipos";

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return null;
  }
  return valor as Record<string, unknown>;
}

function filaPerfil(fila: {
  usuario: string;
  rol: string;
  equipo: string | null;
  preferencias: unknown;
}): Perfil {
  return {
    usuario: fila.usuario,
    rol: fila.rol,
    equipo: fila.equipo,
    preferencias: comoObjeto(fila.preferencias),
  };
}

/** Inserta los tres perfiles sintéticos solo cuando la tabla está vacía. */
export async function sembrarPerfilesSiVacio(sql: Sql): Promise<void> {
  const filas = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM perfiles
  `;
  if (Number(filas[0]?.n ?? 0) > 0) {
    return;
  }
  for (const perfil of PERFILES_SEMILLA) {
    await sql`
      INSERT INTO perfiles (usuario, rol, equipo, preferencias)
      VALUES (
        ${perfil.usuario},
        ${perfil.rol},
        ${perfil.equipo},
        ${sql.json({})}
      )
      ON CONFLICT (usuario) DO NOTHING
    `;
  }
}

export async function leerPerfil(
  sql: Sql,
  usuario: string,
): Promise<Perfil | null> {
  const filas = await sql<
    {
      usuario: string;
      rol: string;
      equipo: string | null;
      preferencias: unknown;
    }[]
  >`
    SELECT usuario, rol, equipo, preferencias
    FROM perfiles
    WHERE usuario = ${usuario}
  `;
  const fila = filas[0];
  return fila ? filaPerfil(fila) : null;
}

export async function actualizarPerfil(
  sql: Sql,
  usuario: string,
  cambios: {
    rol: string;
    equipo: string;
    preferencias: Record<string, unknown> | null;
  },
): Promise<Perfil | null> {
  const filas = await sql<
    {
      usuario: string;
      rol: string;
      equipo: string | null;
      preferencias: unknown;
    }[]
  >`
    UPDATE perfiles
    SET rol = ${cambios.rol},
        equipo = ${cambios.equipo},
        preferencias = ${sql.json(JSON.parse(JSON.stringify(cambios.preferencias ?? {})))}
    WHERE usuario = ${usuario}
    RETURNING usuario, rol, equipo, preferencias
  `;
  const fila = filas[0];
  return fila ? filaPerfil(fila) : null;
}
