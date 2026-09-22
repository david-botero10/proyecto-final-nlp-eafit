/**
 * Fidelidad de recuperación de citas contra la BD de localhost:5432.
 * Híbrida si el servicio de embeddings responde; si no, léxica.
 * El juez LLM solo corre cuando hay XAI_API_KEY.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crearCliente } from "../lib/db/cliente";
import { buscarNorma } from "../mcp/consultas";
import {
  parsearCitas,
  promediarRankings,
  rankingDeCitas,
  type RankingCitas,
} from "./citas_metricas";
import { claveXai, juzgarCitas } from "./juez_citas";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DORADO = path.join(RAIZ, "evaluacion", "citas_doradas.jsonl");
const SALIDA_MD = path.join(RAIZ, "evaluacion", "citas.md");
const SALIDA_JSON = path.join(RAIZ, "evaluacion", "resultados", "citas.json");
const ESPERA_EMBED_MS = 180_000;
const TIMEOUT_EMBED_MS = 60_000;

function urlEmbed(): string {
  return (process.env.EMBED_SERVICE_URL ?? "http://localhost:8631").replace(/\/$/, "");
}

/** Espera a que /embed responda. Si el puerto ni siquiera abre, no espera. */
async function embedListo(): Promise<boolean> {
  const url = `${urlEmbed()}/embed`;
  const cuerpo = JSON.stringify({ textos: ["recargo nocturno"] });
  const intento = async (timeoutMs: number): Promise<"ok" | "ausente" | "espera"> => {
    try {
      const respuesta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (respuesta.ok) {
        return "ok";
      }
      return "espera";
    } catch (error) {
      const codigo =
        error && typeof error === "object" && "cause" in error
          ? (error.cause as { code?: string } | undefined)?.code
          : undefined;
      if (codigo === "ECONNREFUSED" || codigo === "ENOTFOUND") {
        return "ausente";
      }
      return "espera";
    }
  };
  const primero = await intento(5_000);
  if (primero === "ok") {
    return true;
  }
  if (primero === "ausente") {
    return false;
  }
  const limite = Date.now() + ESPERA_EMBED_MS;
  while (Date.now() < limite) {
    const estado = await intento(TIMEOUT_EMBED_MS);
    if (estado === "ok") {
      return true;
    }
    if (estado === "ausente") {
      return false;
    }
  }
  return false;
}

function pct(valor: number): string {
  return `${(valor * 100).toFixed(2)} %`;
}

function celdaJuez(valor: number | null): string {
  return valor === null ? "pendiente" : valor.toFixed(3);
}

export async function evaluarCitas(): Promise<void> {
  const doradas = parsearCitas(readFileSync(DORADO, "utf8"));
  const hibridaDisponible = await embedListo();
  const cliente = crearCliente();
  const filas: {
    id: string;
    pregunta: string;
    modo: "hibrida" | "lexica";
    refs: (string | null)[];
    ranking: RankingCitas;
    fidelidad: number | null;
  }[] = [];
  try {
    for (const dorada of doradas) {
      const salida = await buscarNorma(
        cliente.sql,
        { consulta: dorada.pregunta, k: 8 },
        hibridaDisponible ? { timeoutMs: TIMEOUT_EMBED_MS } : { timeoutMs: 1_000 },
      );
      const refs = salida.resultados.map((fila) => fila.ref);
      const ranking = rankingDeCitas(dorada.refs_esperadas, refs);
      let fidelidad: number | null = null;
      if (claveXai()) {
        const juicio = await juzgarCitas(
          dorada.pregunta,
          salida.resultados.map((fila) => ({
            ref: fila.ref,
            fuente: fila.fuente,
            fragmento: fila.fragmento,
          })),
        );
        fidelidad = juicio ? juicio.fidelidad : null;
      }
      filas.push({
        id: dorada.id,
        pregunta: dorada.pregunta,
        modo: salida.modo,
        refs,
        ranking,
        fidelidad,
      });
    }
  } finally {
    await cliente.cerrar();
  }

  const macro = promediarRankings(filas.map((fila) => fila.ranking));
  const modos = {
    hibrida: filas.filter((fila) => fila.modo === "hibrida").length,
    lexica: filas.filter((fila) => fila.modo === "lexica").length,
  };
  const juezPendiente = filas.every((fila) => fila.fidelidad === null);
  const fidelidadMacro = juezPendiente
    ? null
    : filas.reduce((suma, fila) => suma + (fila.fidelidad ?? 0), 0) / filas.length;

  const detalle = [
    "| id | modo | recall@3 | recall@5 | recall@8 | MRR | juez |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...filas.map(
      (fila) =>
        `| ${fila.id} | ${fila.modo} | ${pct(fila.ranking.recall_at_3)} | ${pct(fila.ranking.recall_at_5)} | ${pct(fila.ranking.recall_at_8)} | ${fila.ranking.mrr.toFixed(3)} | ${celdaJuez(fila.fidelidad)} |`,
    ),
    `| macro |  | ${pct(macro.recall_at_3)} | ${pct(macro.recall_at_5)} | ${pct(macro.recall_at_8)} | ${macro.mrr.toFixed(3)} | ${celdaJuez(fidelidadMacro)} |`,
  ];

  const flojas = filas.filter(
    (fila) => fila.ranking.recall_at_3 < 1 || fila.ranking.mrr < 1,
  );
  const notaHuecos =
    flojas.length === 0
      ? "Las 20 preguntas trajeron todos los artículos esperados en el top 3 y el primer puesto."
      : `Fuera del top 3 o sin el artículo esperado en el primer puesto: ${flojas
          .map(
            (fila) =>
              `${fila.id} (recall@3 ${pct(fila.ranking.recall_at_3)}, MRR ${fila.ranking.mrr.toFixed(3)})`,
          )
          .join("; ")}. El match es por número de artículo, así que un «art. 22» de otra ley también cuenta.`;

  const notaJuez = juezPendiente
    ? "La columna del juez queda pendiente: requiere XAI_API_KEY en el entorno o en .env. `npm run eval:citas` la completa cuando la clave exista; no es un error de gate."
    : `El juez (Grok) puntuó la fidelidad media en ${celdaJuez(fidelidadMacro)}. Cada valor es la fracción de afirmaciones de la respuesta que el juez marcó como soportadas por los fragmentos citados.`;

  const markdown = [
    "# Métrica 2 — fidelidad de citas",
    "",
    "Dataset: `evaluacion/citas_doradas.jsonl` (20 preguntas). Recuperación con `buscarNorma` sobre PostgreSQL en localhost:5432, k=8. El artículo hace match por su número (`art. 168` y cualquier chunk con ese número cuentan igual, aunque el número se repita en otra ley).",
    "",
    `Modo de esta corrida: ${modos.hibrida} híbrida, ${modos.lexica} léxica. La híbrida exige el servicio de embeddings (\`npm run embed:dev\`, puerto 8631). Si no responde, la búsqueda cae a léxica y el modo queda registrado.`,
    "",
    `Recall@k macro: @3 ${pct(macro.recall_at_3)}, @5 ${pct(macro.recall_at_5)}, @8 ${pct(macro.recall_at_8)}. MRR macro: ${macro.mrr.toFixed(3)}. El MRR usa el primer artículo esperado dentro de los 8 devueltos; si no aparece, aporta 0.`,
    "",
    ...detalle,
    "",
    notaHuecos,
    "",
    notaJuez,
    "",
  ].join("\n");

  mkdirSync(path.dirname(SALIDA_JSON), { recursive: true });
  writeFileSync(SALIDA_MD, markdown, "utf8");
  writeFileSync(
    SALIDA_JSON,
    `${JSON.stringify(
      {
        n: filas.length,
        modos,
        macro,
        juez_pendiente: juezPendiente,
        fidelidad_macro: fidelidadMacro,
        filas: filas.map((fila) => ({
          id: fila.id,
          modo: fila.modo,
          refs: fila.refs,
          ...fila.ranking,
          fidelidad: fila.fidelidad,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(markdown);
  console.log(`json: ${path.relative(RAIZ, SALIDA_JSON)}`);
}

function esEntradaPrincipal(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(argv1)).href;
}

if (esEntradaPrincipal()) {
  evaluarCitas().catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : "falló la evaluación";
    console.error(mensaje);
    process.exit(1);
  });
}
