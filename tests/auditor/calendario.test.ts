/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { esDomingo, lunesDe } from "@/lib/a2a/fechas";
import { esFestivo } from "@/auditor/festivos";
import { horasEntre } from "@/auditor/horas";

describe("calendario del auditor", () => {
  it("marca el 12 de octubre de 2026 como festivo y no como domingo", () => {
    expect(esFestivo("2026-10-12")).toBe(true);
    expect(esDomingo("2026-10-12")).toBe(false);
  });

  it("ubica el domingo 4 de octubre en la semana del 28 de septiembre", () => {
    expect(esDomingo("2026-10-04")).toBe(true);
    expect(esFestivo("2026-10-04")).toBe(false);
    expect(lunesDe("2026-10-04")).toBe("2026-09-28");
    expect(esDomingo("2026-09-28")).toBe(false);
    expect(esFestivo("2026-09-28")).toBe(false);
  });

  it("el sábado 8 de agosto de 2026 no es domingo ni festivo", () => {
    expect(lunesDe("2026-08-08")).toBe("2026-08-03");
    expect(esDomingo("2026-08-08")).toBe(false);
    expect(esFestivo("2026-08-08")).toBe(false);
    expect(esFestivo("2026-08-07")).toBe(true);
  });

  it("calcula 8 horas en mañana y en noche que cruza la medianoche", () => {
    expect(horasEntre("06:00:00", "14:00:00", false)).toBe(8);
    expect(horasEntre("14:00:00", "22:00:00", false)).toBe(8);
    expect(horasEntre("22:00:00", "06:00:00", true)).toBe(8);
  });
});
