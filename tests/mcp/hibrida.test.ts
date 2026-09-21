/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearCliente, type Sql } from "@/lib/db/cliente";
import { buscarNorma, fusionarPorRrf, type CandidatoNorma } from "@/mcp/consultas";

async function hayBase(): Promise<boolean> {
  const cliente = crearCliente();
  try {
    await cliente.sql`SELECT 1 AS ok`;
    return true;
  } catch {
    return false;
  } finally {
    await cliente.cerrar();
  }
}

const bdActiva = await hayBase();
if (!bdActiva) {
  console.warn(
    "Se omite la suite híbrida: no hay PostgreSQL accesible.",
  );
}

const TOKEN = "c1hibridozxqpl";

function candidato(
  id: number,
  texto: string,
): CandidatoNorma {
  return {
    chunk_id: id,
    ref: `art. ${id}`,
    fuente: "CST",
    titulo: "Fixture",
    url: null,
    fragmento: texto,
    texto,
  };
}

function vectorUnitario(): number[] {
  return Array.from({ length: 1024 }, (_, indice) => (indice === 0 ? 1 : 0));
}

describe("fusión RRF", () => {
  it("mezcla un hit que solo está en la lista vectorial con uno léxico", () => {
    const fusion = fusionarPorRrf(
      [candidato(1, "solo vector")],
      [candidato(2, "solo lexico")],
    );
    expect(fusion.map((fila) => fila.chunk_id).sort((a, b) => a - b)).toEqual([
      1, 2,
    ]);
    expect(fusion[0]?.score).toBeCloseTo(fusion[1]?.score ?? 0);
  });
});

describe.skipIf(!bdActiva)("buscar_norma híbrida contra la base", () => {
  let sql: Sql;
  let cerrar: () => Promise<void>;

  beforeAll(async () => {
    const conexion = crearCliente();
    sql = conexion.sql;
    cerrar = conexion.cerrar;
    await sql`
      DELETE FROM chunks
      WHERE documento_id IN (
        SELECT id FROM documentos WHERE titulo = ${`c1-hibrida-${TOKEN}`}
      )
    `;
    await sql`DELETE FROM documentos WHERE titulo = ${`c1-hibrida-${TOKEN}`}`;
  });

  afterAll(async () => {
    await cerrar();
  });

  async function sembrar(): Promise<{
    documentoId: number;
    lexicoId: number;
    vectorId: number;
  }> {
    const [documento] = await sql<{ id: number }[]>`
      INSERT INTO documentos (titulo, fuente, tipo, url, hash_sha256)
      VALUES (
        ${`c1-hibrida-${TOKEN}`},
        'CST',
        'ley',
        'https://example.test/c1-hibrida',
        ${`c1-hibrida-${TOKEN}`}
      )
      RETURNING id
    `;
    const literal = `[${vectorUnitario().join(",")}]`;
    const filas = await sql<{ id: number; ref: string }[]>`
      INSERT INTO chunks (documento_id, ref, texto, embedding)
      VALUES
        (
          ${documento.id},
          'art. 9001',
          ${`El ${TOKEN} regula esta prueba de fusion lexica.`},
          NULL
        ),
        (
          ${documento.id},
          'art. 9002',
          'marca-vector-c1 alfalfa quinua sin coincidencia lexica.',
          ${literal}::vector
        )
      RETURNING id, ref
    `;
    const lexico = filas.find((fila) => fila.ref === "art. 9001");
    const vector = filas.find((fila) => fila.ref === "art. 9002");
    if (!lexico || !vector) {
      throw new Error("No se insertaron los chunks de prueba.");
    }
    return {
      documentoId: documento.id,
      lexicoId: lexico.id,
      vectorId: vector.id,
    };
  }

  async function limpiar(documentoId: number) {
    await sql`DELETE FROM chunks WHERE documento_id = ${documentoId}`;
    await sql`DELETE FROM documentos WHERE id = ${documentoId}`;
  }

  it("RRF mezcla un hit vectorial y uno léxico", async () => {
    const sembrado = await sembrar();
    try {
      const salida = await buscarNorma(
        sql,
        { consulta: TOKEN, k: 8 },
        { embed: async () => vectorUnitario() },
      );
      expect(salida.modo).toBe("hibrida");
      const ids = salida.resultados.map((fila) => fila.chunk_id);
      expect(ids).toContain(sembrado.lexicoId);
      expect(ids).toContain(sembrado.vectorId);
    } finally {
      await limpiar(sembrado.documentoId);
    }
  });

  it("el re-ranker inyectado reordena los candidatos", async () => {
    const sembrado = await sembrar();
    try {
      const salida = await buscarNorma(
        sql,
        { consulta: TOKEN, k: 8 },
        {
          embed: async () => vectorUnitario(),
          rerank: async (_consulta, textos) =>
            textos.map((texto) => (texto.includes("marca-vector-c1") ? 10 : 1)),
        },
      );
      expect(salida.modo).toBe("hibrida");
      expect(salida.resultados[0]?.chunk_id).toBe(sembrado.vectorId);
    } finally {
      await limpiar(sembrado.documentoId);
    }
  });

  it("degrada a léxica si el embedding falla", async () => {
    const sembrado = await sembrar();
    try {
      const salida = await buscarNorma(
        sql,
        { consulta: TOKEN, k: 8 },
        {
          embed: async () => {
            throw new Error("servicio caido");
          },
        },
      );
      expect(salida.modo).toBe("lexica");
      const ids = salida.resultados.map((fila) => fila.chunk_id);
      expect(ids).toContain(sembrado.lexicoId);
      expect(ids).not.toContain(sembrado.vectorId);
    } finally {
      await limpiar(sembrado.documentoId);
    }
  });

  it("degrada a léxica si el servicio no responde a tiempo", async () => {
    const sembrado = await sembrar();
    let soltar: () => void = () => undefined;
    try {
      const salida = await buscarNorma(
        sql,
        { consulta: TOKEN, k: 8 },
        {
          timeoutMs: 40,
          embed: () =>
            new Promise((resolve) => {
              soltar = () => resolve(null);
            }),
        },
      );
      expect(salida.modo).toBe("lexica");
      const ids = salida.resultados.map((fila) => fila.chunk_id);
      expect(ids).toContain(sembrado.lexicoId);
      expect(ids).not.toContain(sembrado.vectorId);
    } finally {
      soltar();
      await limpiar(sembrado.documentoId);
    }
  });
});
