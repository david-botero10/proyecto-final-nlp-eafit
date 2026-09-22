import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parsearCitas,
  promediarRankings,
  rankingDeCitas,
  recallEnK,
  reciprocoPrimerRelevante,
} from "../../evaluacion/citas_metricas";
import { fidelidadDe } from "../../evaluacion/juez_citas";

const DORADO = path.join(process.cwd(), "evaluacion", "citas_doradas.jsonl");

const TOP = [
  "art. 160",
  "art. 168",
  "art. 161",
  "art. 179",
  "art. 186",
  "art. 172",
  "art. 187",
  "art. 189",
];

describe("citas doradas", () => {
  it("parsea 20 preguntas con refs", () => {
    const filas = parsearCitas(readFileSync(DORADO, "utf8"));
    expect(filas).toHaveLength(20);
    for (const fila of filas) {
      expect(fila.refs_esperadas.length).toBeGreaterThan(0);
      expect(fila.pregunta.length).toBeGreaterThan(0);
    }
    expect(new Set(filas.map((fila) => fila.id)).size).toBe(20);
  });

  it("rechaza refs vacías y JSON roto", () => {
    expect(() => parsearCitas('{"id":"x","pregunta":"¿y?","refs_esperadas":[]}\n')).toThrow(
      /refs_esperadas/,
    );
    expect(() => parsearCitas("{no es json}\n")).toThrow(/JSON/);
  });
});

describe("recall y MRR calculados a mano", () => {
  it("168 en el puesto 2 y 179 en el puesto 4", () => {
    const esperadas = ["art. 168", "art. 179"];
    expect(recallEnK(esperadas, TOP, 3)).toBe(0.5);
    expect(recallEnK(esperadas, TOP, 5)).toBe(1);
    expect(recallEnK(esperadas, TOP, 8)).toBe(1);
    expect(reciprocoPrimerRelevante(esperadas, TOP)).toBe(0.5);
    expect(rankingDeCitas(esperadas, TOP)).toEqual({
      recall_at_3: 0.5,
      recall_at_5: 1,
      recall_at_8: 1,
      mrr: 0.5,
    });
  });

  it("sin acierto el recíproco es 0", () => {
    const ranking = rankingDeCitas(["art. 236"], ["art. 1"]);
    expect(ranking).toEqual({
      recall_at_3: 0,
      recall_at_5: 0,
      recall_at_8: 0,
      mrr: 0,
    });
  });

  it("promedia dos preguntas: 0.25 y 0.25", () => {
    const macro = promediarRankings([
      rankingDeCitas(["art. 168", "art. 179"], TOP),
      rankingDeCitas(["art. 236"], ["art. 1"]),
    ]);
    expect(macro.recall_at_3).toBe(0.25);
    expect(macro.recall_at_5).toBe(0.5);
    expect(macro.recall_at_8).toBe(0.5);
    expect(macro.mrr).toBe(0.25);
  });

  it("el primer puesto da MRR 1", () => {
    expect(reciprocoPrimerRelevante(["art. 168"], ["art. 168"])).toBe(1);
  });
});

describe("fidelidad del juez", () => {
  it("dos de tres afirmaciones soportadas", () => {
    expect(fidelidadDe([true, false, true])).toBeCloseTo(2 / 3);
  });
});
