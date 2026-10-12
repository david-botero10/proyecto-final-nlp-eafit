/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  DSN_LOCAL,
  esServerless,
  opcionesPostgres,
} from "@/lib/db/cliente";

const NEON =
  "postgresql://u:p@ep-ejemplo-pooler.us-east-2.aws.neon.tech/relevo?sslmode=require";

describe("opciones del cliente de BD", () => {
  it("local: pool de 8 y sentencias preparadas", () => {
    const opciones = opcionesPostgres(DSN_LOCAL, {}, {});
    expect(opciones.max).toBe(8);
    expect(opciones.prepare).toBeUndefined();
    expect(opciones.ssl).toBeUndefined();
    expect(esServerless(DSN_LOCAL, {})).toBe(false);
  });

  it("host de Neon: prepare false, pool 1, ssl y idle corto", () => {
    const opciones = opcionesPostgres(NEON, {}, {});
    expect(opciones.prepare).toBe(false);
    expect(opciones.max).toBe(1);
    expect(opciones.ssl).toBe("require");
    expect(opciones.idle_timeout).toBeLessThanOrEqual(30);
  });

  it("DB_POOL_MAX ajusta el pool serverless", () => {
    expect(opcionesPostgres(NEON, {}, { DB_POOL_MAX: "3" }).max).toBe(3);
    expect(opcionesPostgres(NEON, {}, { DB_POOL_MAX: "x" }).max).toBe(1);
  });

  it("DB_SERVERLESS=1 activa el modo con un host cualquiera", () => {
    const opciones = opcionesPostgres(DSN_LOCAL, {}, { DB_SERVERLESS: "1" });
    expect(opciones.prepare).toBe(false);
    expect(opciones.max).toBe(1);
  });

  it("el máximo explícito (auditor) gana al default serverless", () => {
    expect(opcionesPostgres(NEON, { max: 6 }, {}).max).toBe(6);
  });
});
