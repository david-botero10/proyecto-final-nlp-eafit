import { describe, expect, it } from "vitest";
import { matrizConfusion, tablaMatriz } from "../../evaluacion/matriz";

describe("matriz de confusión", () => {
  it("cuadra el ejemplo calculado a mano", () => {
    const matriz = matrizConfusion([
      { esperado: "aprobado", predicho: "aprobado" },
      { esperado: "aprobado", predicho: "observaciones" },
      { esperado: "observaciones", predicho: "observaciones" },
      { esperado: "rechazado", predicho: "rechazado" },
    ]);
    expect(matriz.cuentas).toEqual([
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(matriz.precision.aprobado).toBe(1);
    expect(matriz.precision.observaciones).toBe(0.5);
    expect(matriz.precision.rechazado).toBe(1);
    expect(matriz.soporte_esperado).toEqual({
      aprobado: 2,
      observaciones: 1,
      rechazado: 1,
    });
    expect(tablaMatriz(matriz)).toContain("| aprobado | 1 | 1 | 0 |");
  });

  it("precisión nula si la clase no se predice", () => {
    const matriz = matrizConfusion([
      { esperado: "aprobado", predicho: "aprobado" },
    ]);
    expect(matriz.precision.rechazado).toBeNull();
    expect(matriz.precision.observaciones).toBeNull();
    expect(matriz.precision.aprobado).toBe(1);
  });
});
