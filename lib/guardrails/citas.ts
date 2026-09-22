export const NOTA_CITAS =
  "Esta respuesta no cita la norma; verifícala";

const CITA = /\[\d+\]/;

export type EvaluacionCitas = {
  aplica: boolean;
  anexar: boolean;
};

/** La nota solo se anexa si fue consulta de norma, no hay [n] y no se llamó buscar_norma. */
export function evaluarCitas(
  intencion: string,
  texto: string,
  llamoBuscarNorma: boolean,
): EvaluacionCitas {
  const aplica = intencion === "consulta_norma";
  return {
    aplica,
    anexar: aplica && !CITA.test(texto) && !llamoBuscarNorma,
  };
}

export function anexarNotaCitas(texto: string): string {
  return `${texto.trimEnd()}\n\n${NOTA_CITAS}`;
}
