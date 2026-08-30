import postgres, { type Sql } from "postgres";

/** DSN local de desarrollo (credenciales sintéticas, no es un secreto). */
export const DSN_LOCAL = "postgresql://relevo:relevo@localhost:5432/relevo";

export type { Sql };

export type ClienteSql = {
  sql: Sql;
  cerrar: () => Promise<void>;
};

/**
 * Factory de postgres-js. Lee DATABASE_URL o el default local.
 * El cierre corta el pool; no registra el DSN.
 */
export function crearCliente(
  dsn: string = process.env.DATABASE_URL ?? DSN_LOCAL,
): ClienteSql {
  const sql = postgres(dsn, {
    max: 8,
    onnotice: () => undefined,
  });
  return {
    sql,
    cerrar: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
