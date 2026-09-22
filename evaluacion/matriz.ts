/** Matriz de confusión 3×3 del veredicto del auditor. */

export const CLASES_VEREDICTO = [
  "aprobado",
  "observaciones",
  "rechazado",
] as const;

export type ClaseVeredicto = (typeof CLASES_VEREDICTO)[number];

export type ParVeredicto = {
  esperado: ClaseVeredicto;
  predicho: ClaseVeredicto;
};

export type MatrizVeredicto = {
  etiquetas: readonly ClaseVeredicto[];
  /** Filas = esperado, columnas = predicho, en el orden de `etiquetas`. */
  cuentas: number[][];
  precision: Record<ClaseVeredicto, number | null>;
  soporte_esperado: Record<ClaseVeredicto, number>;
  soporte_predicho: Record<ClaseVeredicto, number>;
};

function indiceDe(clase: ClaseVeredicto): number {
  const indice = CLASES_VEREDICTO.indexOf(clase);
  if (indice < 0) {
    throw new Error(`Clase desconocida: ${clase}`);
  }
  return indice;
}

export function esClaseVeredicto(valor: string): valor is ClaseVeredicto {
  return (CLASES_VEREDICTO as readonly string[]).includes(valor);
}

export function matrizConfusion(pares: readonly ParVeredicto[]): MatrizVeredicto {
  const cuentas = CLASES_VEREDICTO.map(() => CLASES_VEREDICTO.map(() => 0));
  for (const par of pares) {
    cuentas[indiceDe(par.esperado)][indiceDe(par.predicho)] += 1;
  }
  const precision = {} as Record<ClaseVeredicto, number | null>;
  const soporteEsperado = {} as Record<ClaseVeredicto, number>;
  const soportePredicho = {} as Record<ClaseVeredicto, number>;
  for (const clase of CLASES_VEREDICTO) {
    const columna = indiceDe(clase);
    const fila = indiceDe(clase);
    let predichos = 0;
    let esperados = 0;
    for (let i = 0; i < CLASES_VEREDICTO.length; i += 1) {
      predichos += cuentas[i][columna];
      esperados += cuentas[fila][i];
    }
    precision[clase] = predichos === 0 ? null : cuentas[fila][columna] / predichos;
    soporteEsperado[clase] = esperados;
    soportePredicho[clase] = predichos;
  }
  return {
    etiquetas: CLASES_VEREDICTO,
    cuentas,
    precision,
    soporte_esperado: soporteEsperado,
    soporte_predicho: soportePredicho,
  };
}

export function tablaMatriz(matriz: MatrizVeredicto): string {
  const encabezado = `| esperado \\\\ predicho | ${matriz.etiquetas.join(" | ")} |`;
  const separador = `|---|${matriz.etiquetas.map(() => "---:").join("|")}|`;
  const filas = matriz.etiquetas.map((etiqueta, fila) => {
    const celdas = matriz.cuentas[fila].join(" | ");
    return `| ${etiqueta} | ${celdas} |`;
  });
  return [encabezado, separador, ...filas].join("\n");
}
