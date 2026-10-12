import postgres, { type Options, type Sql } from "postgres";

/** DSN local de desarrollo (credenciales sintéticas, no es un secreto). */
export const DSN_LOCAL = "postgresql://relevo:relevo@localhost:5432/relevo";

export type { Sql };

export type ClienteSql = {
  sql: Sql;
  cerrar: () => Promise<void>;
};

export type OpcionesCliente = {
  /** Tope de conexiones. Por defecto 8 en local y DB_POOL_MAX (o 1) en la nube. */
  max?: number;
};

const MAX_LOCAL = 8;
const MAX_SERVERLESS = 1;

type Entorno = Record<string, string | undefined>;

/**
 * Modo serverless: el host es de Neon o DB_SERVERLESS=1. El pooler de Neon
 * trabaja en modo transacción: no admite sentencias preparadas ni `SET`
 * de sesión (solo `SET LOCAL` dentro de una transacción).
 */
export function esServerless(
  dsn: string,
  entorno: Entorno = process.env,
): boolean {
  return entorno.DB_SERVERLESS === "1" || /neon\.tech/i.test(hostDe(dsn));
}

function hostDe(dsn: string): string {
  try {
    return new URL(dsn).hostname;
  } catch {
    return "";
  }
}

/** Opciones de postgres-js según el entorno. Pura, para poder probarla. */
export function opcionesPostgres(
  dsn: string,
  opciones: OpcionesCliente = {},
  entorno: Entorno = process.env,
): Options<Record<string, never>> {
  const base: Options<Record<string, never>> = {
    max: opciones.max ?? MAX_LOCAL,
    onnotice: () => undefined,
  };
  if (!esServerless(dsn, entorno)) {
    return base;
  }
  const crudo = Number(entorno.DB_POOL_MAX);
  const maxNube =
    Number.isInteger(crudo) && crudo > 0 ? crudo : MAX_SERVERLESS;
  return {
    ...base,
    max: opciones.max ?? maxNube,
    prepare: false,
    ssl: "require",
    idle_timeout: 10,
    connect_timeout: 15,
  };
}

/**
 * Factory de postgres-js. Lee DATABASE_URL o el default local.
 * El cierre corta el pool; no registra el DSN.
 */
export function crearCliente(
  dsn: string = process.env.DATABASE_URL ?? DSN_LOCAL,
  opciones: OpcionesCliente = {},
): ClienteSql {
  const sql = postgres(dsn, opcionesPostgres(dsn, opciones));
  return {
    sql,
    cerrar: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
