import type { Sql } from "../lib/db/cliente";
import type {
  BuscarNormaEntrada,
  ConsultarAusenciasEntrada,
  ConsultarTurnosEntrada,
  ListarEmpleadosEntrada,
} from "./esquemas";

// Token compartido con los servicios de modelos en Modal (deploy/modal).
// Sin MODELOS_TOKEN (modo local) no se envía cabecera.
function authModelos(): Record<string, string> {
  const token = process.env.MODELOS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type FiltroEmpleado = {
  id: number | null;
  nombre: string | null;
};

function filtroEmpleado(
  empleado: number | string | undefined,
): FiltroEmpleado {
  if (empleado === undefined) {
    return { id: null, nombre: null };
  }
  if (typeof empleado === "number" || /^[0-9]+$/.test(empleado)) {
    return { id: Number(empleado), nombre: null };
  }
  return { id: null, nombre: empleado };
}

export async function listarEmpleados(
  sql: Sql,
  filtros: ListarEmpleadosEntrada,
) {
  const equipo = filtros.equipo ?? null;
  const activo = filtros.activo ?? null;
  return sql<{
    id: number;
    nombre: string;
    rol: string;
    equipo: string;
  }[]>`
    SELECT id, nombre, rol, equipo
    FROM empleados
    WHERE (${equipo}::text IS NULL OR equipo = ${equipo})
      AND (${activo}::boolean IS NULL OR activo = ${activo})
    ORDER BY nombre
  `;
}

export async function consultarTurnos(
  sql: Sql,
  filtros: ConsultarTurnosEntrada,
) {
  const { id, nombre } = filtroEmpleado(filtros.empleado);
  const patron = nombre === null ? null : `%${nombre}%`;
  const turno = filtros.turno ?? null;
  return sql<{
    empleado: string;
    turno: string;
    turno_nombre: string;
    fecha: string;
    estado: string;
  }[]>`
    SELECT
      e.nombre AS empleado,
      t.codigo AS turno,
      t.nombre AS turno_nombre,
      a.fecha::text AS fecha,
      a.estado
    FROM asignaciones a
    JOIN empleados e ON e.id = a.empleado_id
    JOIN turnos t ON t.id = a.turno_id
    WHERE a.fecha BETWEEN ${filtros.desde}::date AND ${filtros.hasta}::date
      AND (${id}::int IS NULL OR e.id = ${id})
      AND (${patron}::text IS NULL OR e.nombre ILIKE ${patron})
      AND (${turno}::text IS NULL OR t.codigo = ${turno})
    ORDER BY a.fecha, e.nombre
  `;
}

export async function consultarAusencias(
  sql: Sql,
  filtros: ConsultarAusenciasEntrada,
) {
  const { id, nombre } = filtroEmpleado(filtros.empleado);
  const patron = nombre === null ? null : `%${nombre}%`;
  const tipo = filtros.tipo ?? null;
  return sql<{
    empleado: string;
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    motivo: string | null;
  }[]>`
    SELECT
      e.nombre AS empleado,
      a.tipo,
      a.fecha_inicio::text AS fecha_inicio,
      a.fecha_fin::text AS fecha_fin,
      a.estado,
      a.motivo
    FROM ausencias a
    JOIN empleados e ON e.id = a.empleado_id
    WHERE a.fecha_inicio <= ${filtros.hasta}::date
      AND a.fecha_fin >= ${filtros.desde}::date
      AND (${id}::int IS NULL OR e.id = ${id})
      AND (${patron}::text IS NULL OR e.nombre ILIKE ${patron})
      AND (${tipo}::text IS NULL OR a.tipo = ${tipo})
    ORDER BY a.fecha_inicio, e.nombre
  `;
}

const K_RRF = 60;
const TOPE_RAMA = 30;
const TOPE_FUSION = 20;
const DIM_EMBEDDING = 1024;
const TIMEOUT_EMBED_MS = 3000;
const URL_EMBED_DEFAULT = "http://localhost:8631";

export type ResultadoNorma = {
  chunk_id: number;
  ref: string | null;
  fuente: string;
  titulo: string;
  url: string | null;
  fragmento: string;
  score: number;
};

export type CandidatoNorma = {
  chunk_id: number;
  ref: string | null;
  fuente: string;
  titulo: string;
  url: string | null;
  fragmento: string;
  texto: string;
};

export type BuscarNormaSalida = {
  modo: "hibrida" | "lexica";
  resultados: ResultadoNorma[];
};

export type EmbedConsulta = (consulta: string) => Promise<number[] | null>;

export type RerankConsulta = (
  consulta: string,
  textos: string[],
) => Promise<number[] | null>;

export type OpcionesBuscarNorma = {
  embed?: EmbedConsulta;
  rerank?: RerankConsulta;
  timeoutMs?: number;
  urlEmbed?: string;
};

type FilaLexica = {
  chunk_id: number;
  ref: string | null;
  fuente: string;
  titulo: string;
  url: string | null;
  fragmento: string;
  score: number | string;
};

type FilaCandidata = FilaLexica & { texto: string };

function comoNumero(valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function vectorValido(valor: number[] | null): valor is number[] {
  return (
    Array.isArray(valor) &&
    valor.length === DIM_EMBEDDING &&
    valor.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function literalVector(vector: number[]): string {
  return `[${vector.map((n) => n.toFixed(8)).join(",")}]`;
}

function conTiempo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promesa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function urlEmbed(opciones?: OpcionesBuscarNorma): string {
  const base =
    opciones?.urlEmbed ??
    process.env.EMBED_SERVICE_URL ??
    URL_EMBED_DEFAULT;
  return base.replace(/\/$/, "");
}

async function embedPorHttp(
  consulta: string,
  opciones: OpcionesBuscarNorma | undefined,
  timeoutMs: number,
): Promise<number[] | null> {
  const respuesta = await fetch(`${urlEmbed(opciones)}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authModelos() },
    body: JSON.stringify({ textos: [consulta] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!respuesta.ok) {
    return null;
  }
  const cuerpo = (await respuesta.json()) as { vectores?: unknown };
  const primero = Array.isArray(cuerpo.vectores) ? cuerpo.vectores[0] : null;
  if (!Array.isArray(primero)) {
    return null;
  }
  const vector = primero.map((n) => Number(n));
  return vectorValido(vector) ? vector : null;
}

async function rerankPorHttp(
  consulta: string,
  textos: string[],
  opciones: OpcionesBuscarNorma | undefined,
  timeoutMs: number,
): Promise<number[] | null> {
  const respuesta = await fetch(`${urlEmbed(opciones)}/rerank`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authModelos() },
    body: JSON.stringify({ consulta, textos }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!respuesta.ok) {
    return null;
  }
  const cuerpo = (await respuesta.json()) as { scores?: unknown };
  if (!Array.isArray(cuerpo.scores) || cuerpo.scores.length !== textos.length) {
    return null;
  }
  const scores = cuerpo.scores.map((n) => Number(n));
  if (scores.some((n) => !Number.isFinite(n))) {
    return null;
  }
  return scores;
}

async function obtenerEmbedding(
  consulta: string,
  opciones: OpcionesBuscarNorma | undefined,
): Promise<number[] | null> {
  const timeoutMs = opciones?.timeoutMs ?? TIMEOUT_EMBED_MS;
  try {
    const vector = await conTiempo(
      opciones?.embed
        ? opciones.embed(consulta)
        : embedPorHttp(consulta, opciones, timeoutMs),
      timeoutMs,
    );
    return vectorValido(vector) ? vector : null;
  } catch {
    return null;
  }
}

async function obtenerRerank(
  consulta: string,
  textos: string[],
  opciones: OpcionesBuscarNorma | undefined,
): Promise<number[] | null> {
  if (textos.length === 0) {
    return null;
  }
  const timeoutMs = opciones?.timeoutMs ?? TIMEOUT_EMBED_MS;
  try {
    const scores = await conTiempo(
      opciones?.rerank
        ? opciones.rerank(consulta, textos)
        : rerankPorHttp(consulta, textos, opciones, timeoutMs),
      timeoutMs,
    );
    if (!scores || scores.length !== textos.length) {
      return null;
    }
    if (scores.some((n) => !Number.isFinite(n))) {
      return null;
    }
    return scores;
  } catch {
    return null;
  }
}

function aCandidato(fila: FilaCandidata): CandidatoNorma {
  return {
    chunk_id: Number(fila.chunk_id),
    ref: fila.ref,
    fuente: fila.fuente,
    titulo: fila.titulo,
    url: fila.url,
    fragmento: fila.fragmento,
    texto: fila.texto,
  };
}

function publicar(fila: CandidatoNorma, score: number): ResultadoNorma {
  return {
    chunk_id: fila.chunk_id,
    ref: fila.ref,
    fuente: fila.fuente,
    titulo: fila.titulo,
    url: fila.url,
    fragmento: fila.fragmento,
    score,
  };
}

/** Fusión Reciprocal Rank Fusion con k = 60. El léxico gana el fragmento. */
export function fusionarPorRrf(
  vectoriales: CandidatoNorma[],
  lexicos: CandidatoNorma[],
): Array<CandidatoNorma & { score: number }> {
  const puntaje = new Map<number, number>();
  const filas = new Map<number, CandidatoNorma>();

  const sumar = (lista: CandidatoNorma[], preferirFragmento: boolean) => {
    lista.forEach((fila, indice) => {
      puntaje.set(
        fila.chunk_id,
        (puntaje.get(fila.chunk_id) ?? 0) + 1 / (K_RRF + indice + 1),
      );
      const previa = filas.get(fila.chunk_id);
      if (!previa) {
        filas.set(fila.chunk_id, fila);
        return;
      }
      if (preferirFragmento) {
        filas.set(fila.chunk_id, {
          ...fila,
          texto: fila.texto || previa.texto,
        });
      }
    });
  };

  sumar(vectoriales, false);
  sumar(lexicos, true);

  return [...puntaje.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, TOPE_FUSION)
    .flatMap(([id, score]) => {
      const fila = filas.get(id);
      return fila ? [{ ...fila, score }] : [];
    });
}

async function buscarLexica(
  sql: Sql,
  consulta: string,
  limite: number,
): Promise<ResultadoNorma[]> {
  const filas = await sql<FilaLexica[]>`
    WITH consulta AS (
      SELECT websearch_to_tsquery('spanish', es_unaccent(${consulta})) AS tsq
    )
    SELECT
      c.id AS chunk_id,
      c.ref,
      d.fuente,
      d.titulo,
      d.url,
      COALESCE(
        NULLIF(
          ts_headline(
            'spanish',
            c.texto,
            consulta.tsq,
            'MaxFragments=1, MaxWords=50, MinWords=15'
          ),
          ''
        ),
        left(c.texto, 300)
      ) AS fragmento,
      ts_rank_cd(c.tsv, consulta.tsq) AS score
    FROM chunks c
    JOIN documentos d ON d.id = c.documento_id
    CROSS JOIN consulta
    WHERE consulta.tsq IS NOT NULL
      AND consulta.tsq::text <> ''
      AND c.tsv @@ consulta.tsq
    ORDER BY score DESC, c.id
    LIMIT ${limite}
  `;
  return filas.map((fila) => ({
    chunk_id: Number(fila.chunk_id),
    ref: fila.ref,
    fuente: fila.fuente,
    titulo: fila.titulo,
    url: fila.url,
    fragmento: fila.fragmento,
    score: comoNumero(fila.score),
  }));
}

async function candidatosLexicos(
  sql: Sql,
  consulta: string,
): Promise<CandidatoNorma[]> {
  const filas = await sql<FilaCandidata[]>`
    WITH consulta AS (
      SELECT websearch_to_tsquery('spanish', es_unaccent(${consulta})) AS tsq
    )
    SELECT
      c.id AS chunk_id,
      c.ref,
      d.fuente,
      d.titulo,
      d.url,
      c.texto,
      COALESCE(
        NULLIF(
          ts_headline(
            'spanish',
            c.texto,
            consulta.tsq,
            'MaxFragments=1, MaxWords=50, MinWords=15'
          ),
          ''
        ),
        left(c.texto, 300)
      ) AS fragmento,
      ts_rank_cd(c.tsv, consulta.tsq) AS score
    FROM chunks c
    JOIN documentos d ON d.id = c.documento_id
    CROSS JOIN consulta
    WHERE consulta.tsq IS NOT NULL
      AND consulta.tsq::text <> ''
      AND c.tsv @@ consulta.tsq
    ORDER BY score DESC, c.id
    LIMIT ${TOPE_RAMA}
  `;
  return filas.map(aCandidato);
}

async function candidatosVectoriales(
  sql: Sql,
  vector: number[],
): Promise<CandidatoNorma[]> {
  const literal = literalVector(vector);
  const filas = await sql<FilaCandidata[]>`
    SELECT
      c.id AS chunk_id,
      c.ref,
      d.fuente,
      d.titulo,
      d.url,
      c.texto,
      left(c.texto, 300) AS fragmento,
      0 AS score
    FROM chunks c
    JOIN documentos d ON d.id = c.documento_id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector, c.id
    LIMIT ${TOPE_RAMA}
  `;
  return filas.map(aCandidato);
}

export async function buscarNorma(
  sql: Sql,
  filtros: BuscarNormaEntrada,
  opciones?: OpcionesBuscarNorma,
): Promise<BuscarNormaSalida> {
  const k = filtros.k ?? 8;
  const vector = await obtenerEmbedding(filtros.consulta, opciones);
  if (!vector) {
    return {
      modo: "lexica",
      resultados: await buscarLexica(sql, filtros.consulta, k),
    };
  }

  const [lexicos, vectoriales] = await Promise.all([
    candidatosLexicos(sql, filtros.consulta),
    candidatosVectoriales(sql, vector),
  ]);
  let fusion = fusionarPorRrf(vectoriales, lexicos);
  const scores = await obtenerRerank(
    filtros.consulta,
    fusion.map((fila) => fila.texto),
    opciones,
  );
  if (scores) {
    fusion = fusion
      .map((fila, indice) => ({ ...fila, score: scores[indice] ?? fila.score }))
      .sort((a, b) => b.score - a.score || a.chunk_id - b.chunk_id);
  }

  return {
    modo: "hibrida",
    resultados: fusion.slice(0, k).map((fila) => publicar(fila, fila.score)),
  };
}
