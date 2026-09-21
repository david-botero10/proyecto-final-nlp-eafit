export type ResultadoFuente = {
  chunk_id: number;
  ref: string | null;
  fuente: string;
  titulo: string;
  url: string | null;
  fragmento: string;
  score: number;
};

export type ParteVista = {
  type: string;
  text?: string;
  state?: string;
  toolName?: string;
  data?: unknown;
  output?: unknown;
};

const ETIQUETAS: Record<string, string> = {
  charla: "charla",
  consulta_datos: "consulta de datos",
  consulta_norma: "consulta de norma",
  orden_escritura: "orden de escritura",
};

function esResultado(valor: unknown): valor is ResultadoFuente {
  if (!valor || typeof valor !== "object") {
    return false;
  }
  const fila = valor as Record<string, unknown>;
  return (
    typeof fila.chunk_id === "number" &&
    typeof fila.fuente === "string" &&
    typeof fila.titulo === "string" &&
    typeof fila.fragmento === "string" &&
    typeof fila.score === "number" &&
    (fila.ref === null || typeof fila.ref === "string") &&
    (fila.url === null || typeof fila.url === "string")
  );
}

function leerResultados(salida: unknown): ResultadoFuente[] {
  if (!salida || typeof salida !== "object" || !("resultados" in salida)) {
    return [];
  }
  const lista = (salida as { resultados: unknown }).resultados;
  if (!Array.isArray(lista)) {
    return [];
  }
  return lista.filter(esResultado);
}

function esBuscarNorma(parte: ParteVista): boolean {
  if (parte.type === "tool-buscar_norma") {
    return true;
  }
  return parte.type === "dynamic-tool" && parte.toolName === "buscar_norma";
}

function esHerramienta(parte: ParteVista): boolean {
  return parte.type.startsWith("tool-") || parte.type === "dynamic-tool";
}

function enCurso(parte: ParteVista): boolean {
  return parte.state === "input-streaming" || parte.state === "input-available";
}

export function indicadorDePartes(parts: ParteVista[]): string | null {
  if (parts.some((parte) => esBuscarNorma(parte) && enCurso(parte))) {
    return "consultando norma…";
  }
  if (parts.some((parte) => esHerramienta(parte) && enCurso(parte))) {
    return "consultando…";
  }
  return null;
}

function intencionDe(parts: ParteVista[]): string | null {
  for (const parte of parts) {
    if (parte.type !== "data-intencion" || !parte.data) {
      continue;
    }
    if (typeof parte.data !== "object" || !("intencion" in parte.data)) {
      continue;
    }
    const intencion = (parte.data as { intencion?: unknown }).intencion;
    if (typeof intencion === "string" && intencion.length > 0) {
      return intencion;
    }
  }
  return null;
}

export function gruposFuentes(parts: ParteVista[]): ResultadoFuente[][] {
  const grupos: ResultadoFuente[][] = [];
  for (const parte of parts) {
    if (!esBuscarNorma(parte) || parte.state !== "output-available") {
      continue;
    }
    const resultados = leerResultados(parte.output);
    if (resultados.length > 0) {
      grupos.push(resultados);
    }
  }
  return grupos;
}

function hrefSeguro(url: string | null): string | null {
  if (!url) {
    return null;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url;
  }
  return null;
}

export function ChipIntencion({ intencion }: { intencion: string }) {
  const etiqueta = ETIQUETAS[intencion] ?? intencion;
  return (
    <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
      {etiqueta}
    </span>
  );
}

export function PanelFuentes({
  resultados,
}: {
  resultados: ResultadoFuente[];
}) {
  if (resultados.length === 0) {
    return null;
  }
  return (
    <section aria-label="Fuentes" className="mt-3 border-t border-stone-200 pt-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Fuentes
      </h2>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-stone-600">
        {resultados.map((resultado, indice) => {
          const href = hrefSeguro(resultado.url);
          return (
            <li key={`${resultado.chunk_id}-${indice}`}>
              <span className="font-medium text-stone-800">
                {resultado.fuente}
              </span>
              {resultado.ref ? ` · ${resultado.ref}` : null}
              {" · "}
              {href ? (
                <a
                  href={href}
                  className="underline decoration-stone-300 underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {resultado.titulo}
                </a>
              ) : (
                resultado.titulo
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function MensajeAsistente({ parts }: { parts: ParteVista[] }) {
  const texto = parts
    .filter((parte) => parte.type === "text" && parte.text)
    .map((parte) => parte.text ?? "")
    .join("");
  const intencion = intencionDe(parts);
  const aviso = indicadorDePartes(parts);
  const grupos = gruposFuentes(parts);

  return (
    <div>
      {intencion ? (
        <div className="mb-2">
          <ChipIntencion intencion={intencion} />
        </div>
      ) : null}
      {texto ? <p className="whitespace-pre-wrap">{texto}</p> : null}
      {aviso ? (
        <p className="mt-2 text-xs text-stone-500" aria-live="polite">
          {aviso}
        </p>
      ) : null}
      {grupos.map((grupo, indice) => (
        <PanelFuentes key={indice} resultados={grupo} />
      ))}
    </div>
  );
}
