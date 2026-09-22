/** Recall@k y MRR sobre artículos normalizados (`art. 168` → `168`). */

export type CitaDorada = {
  id: string;
  pregunta: string;
  refs_esperadas: string[];
};

export type RankingCitas = {
  recall_at_3: number;
  recall_at_5: number;
  recall_at_8: number;
  mrr: number;
};

const REF_ARTICULO = /^art\. \d+$/;

export function articuloDe(ref: string | null | undefined): string | null {
  if (!ref) {
    return null;
  }
  const coincidencia = ref.match(/\d+/);
  return coincidencia ? coincidencia[0] : null;
}

export function parsearCitas(texto: string): CitaDorada[] {
  const filas: CitaDorada[] = [];
  const ids = new Set<string>();
  const lineas = texto.split(/\r?\n/);
  for (const [indice, cruda] of lineas.entries()) {
    const linea = cruda.trim();
    if (!linea) {
      continue;
    }
    let valor: unknown;
    try {
      valor = JSON.parse(linea) as unknown;
    } catch {
      throw new Error(`Línea ${indice + 1}: JSON inválido.`);
    }
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
      throw new Error(`Línea ${indice + 1}: se esperaba un objeto.`);
    }
    const fila = valor as {
      id?: unknown;
      pregunta?: unknown;
      refs_esperadas?: unknown;
    };
    if (typeof fila.id !== "string" || fila.id.trim().length === 0) {
      throw new Error(`Línea ${indice + 1}: id vacío.`);
    }
    if (ids.has(fila.id)) {
      throw new Error(`Línea ${indice + 1}: id repetido ${fila.id}.`);
    }
    if (typeof fila.pregunta !== "string" || fila.pregunta.trim().length === 0) {
      throw new Error(`Línea ${indice + 1}: pregunta vacía.`);
    }
    if (!Array.isArray(fila.refs_esperadas) || fila.refs_esperadas.length === 0) {
      throw new Error(`Línea ${indice + 1}: refs_esperadas vacío.`);
    }
    const refs: string[] = [];
    for (const ref of fila.refs_esperadas) {
      if (typeof ref !== "string" || !REF_ARTICULO.test(ref)) {
        throw new Error(`Línea ${indice + 1}: ref inválida.`);
      }
      refs.push(ref);
    }
    ids.add(fila.id);
    filas.push({
      id: fila.id,
      pregunta: fila.pregunta.trim(),
      refs_esperadas: refs,
    });
  }
  if (filas.length === 0) {
    throw new Error("El dataset dorado no tiene preguntas.");
  }
  return filas;
}

/** Fracción de artículos esperados que aparecen en el top k. */
export function recallEnK(
  esperadas: string[],
  recuperadas: readonly (string | null)[],
  k: number,
): number {
  const objetivos = new Set(
    esperadas
      .map((ref) => articuloDe(ref))
      .filter((articulo): articulo is string => articulo !== null),
  );
  if (objetivos.size === 0) {
    throw new Error("No hay artículos esperados.");
  }
  const top = new Set(
    recuperadas
      .slice(0, k)
      .map((ref) => articuloDe(ref))
      .filter((articulo): articulo is string => articulo !== null),
  );
  let aciertos = 0;
  for (const articulo of objetivos) {
    if (top.has(articulo)) {
      aciertos += 1;
    }
  }
  return aciertos / objetivos.size;
}

/**
 * Rango recíproco del primer artículo esperado.
 * Si no está en la lista devuelta, el aporte es 0.
 */
export function reciprocoPrimerRelevante(
  esperadas: string[],
  recuperadas: readonly (string | null)[],
): number {
  const objetivos = new Set(
    esperadas
      .map((ref) => articuloDe(ref))
      .filter((articulo): articulo is string => articulo !== null),
  );
  if (objetivos.size === 0) {
    throw new Error("No hay artículos esperados.");
  }
  for (let indice = 0; indice < recuperadas.length; indice += 1) {
    const articulo = articuloDe(recuperadas[indice]);
    if (articulo && objetivos.has(articulo)) {
      return 1 / (indice + 1);
    }
  }
  return 0;
}

export function rankingDeCitas(
  esperadas: string[],
  recuperadas: readonly (string | null)[],
): RankingCitas {
  return {
    recall_at_3: recallEnK(esperadas, recuperadas, 3),
    recall_at_5: recallEnK(esperadas, recuperadas, 5),
    recall_at_8: recallEnK(esperadas, recuperadas, 8),
    mrr: reciprocoPrimerRelevante(esperadas, recuperadas),
  };
}

export function promediarRankings(filas: readonly RankingCitas[]): RankingCitas {
  if (filas.length === 0) {
    throw new Error("No hay rankings para promediar.");
  }
  const suma = filas.reduce(
    (acumulado, fila) => ({
      recall_at_3: acumulado.recall_at_3 + fila.recall_at_3,
      recall_at_5: acumulado.recall_at_5 + fila.recall_at_5,
      recall_at_8: acumulado.recall_at_8 + fila.recall_at_8,
      mrr: acumulado.mrr + fila.mrr,
    }),
    { recall_at_3: 0, recall_at_5: 0, recall_at_8: 0, mrr: 0 },
  );
  const n = filas.length;
  return {
    recall_at_3: suma.recall_at_3 / n,
    recall_at_5: suma.recall_at_5 / n,
    recall_at_8: suma.recall_at_8 / n,
    mrr: suma.mrr / n,
  };
}
