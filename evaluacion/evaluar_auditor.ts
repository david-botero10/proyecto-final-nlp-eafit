/**
 * Corre los 10 escenarios de D2 y los 10 de F1 contra el auditor real
 * y escribe precisión por clase más la matriz 3×3.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { iniciarAuditor } from "../auditor/servidor";
import { auditarPropuesta, olvidarCacheAuditor } from "../lib/a2a/cliente";
import { crearCliente } from "../lib/db/cliente";
import type { Veredicto } from "../lib/tipos";
import { escenariosD2, type EscenarioMedible } from "./escenarios_d2";
import { escenariosExtra } from "./escenarios_extra";
import {
  esClaseVeredicto,
  matrizConfusion,
  tablaMatriz,
  type ClaseVeredicto,
} from "./matriz";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA_MD = path.join(RAIZ, "evaluacion", "auditor.md");
const SALIDA_JSON = path.join(RAIZ, "evaluacion", "resultados", "auditor.json");

function pct(valor: number | null): string {
  if (valor === null) {
    return "—";
  }
  return `${(valor * 100).toFixed(2)} %`;
}

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

export async function evaluarAuditor(): Promise<void> {
  if (!(await hayBase())) {
    throw new Error("Se necesita PostgreSQL en localhost:5432 con el seed de Relevo.");
  }
  const embedPrevio = process.env.EMBED_SERVICE_URL;
  const xaiPrevia = process.env.XAI_API_KEY;
  const urlPrevia = process.env.AUDITOR_URL;
  process.env.EMBED_SERVICE_URL = "http://127.0.0.1:9";
  process.env.AUDITOR_RAZONES_LLM = "0";
  delete process.env.XAI_API_KEY;
  const auditor = await iniciarAuditor({ puerto: 0 });
  process.env.AUDITOR_URL = auditor.url;
  olvidarCacheAuditor();
  const escenarios = [...escenariosD2(), ...escenariosExtra()];
  const corridas: {
    id: string;
    titulo: string;
    origen: EscenarioMedible["origen"];
    esperado: Veredicto;
    predicho: Veredicto;
    razones: string[];
  }[] = [];
  try {
    for (const escenario of escenarios) {
      const veredicto = await auditarPropuesta(escenario.propuesta);
      if (!veredicto || !esClaseVeredicto(veredicto.veredicto)) {
        throw new Error(`Sin veredicto para ${escenario.id}.`);
      }
      corridas.push({
        id: escenario.id,
        titulo: escenario.titulo,
        origen: escenario.origen,
        esperado: escenario.esperado,
        predicho: veredicto.veredicto,
        razones: veredicto.razones,
      });
    }
  } finally {
    olvidarCacheAuditor();
    await auditor.cerrar();
    if (embedPrevio === undefined) {
      delete process.env.EMBED_SERVICE_URL;
    } else {
      process.env.EMBED_SERVICE_URL = embedPrevio;
    }
    delete process.env.AUDITOR_RAZONES_LLM;
    if (xaiPrevia === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = xaiPrevia;
    }
    if (urlPrevia === undefined) {
      delete process.env.AUDITOR_URL;
    } else {
      process.env.AUDITOR_URL = urlPrevia;
    }
  }

  const matriz = matrizConfusion(
    corridas.map((fila) => ({
      esperado: fila.esperado as ClaseVeredicto,
      predicho: fila.predicho as ClaseVeredicto,
    })),
  );
  const aciertos = corridas.filter((fila) => fila.esperado === fila.predicho).length;
  const tabla = [
    "| id | origen | título | esperado | predicho |",
    "|---|---|---|---|---|",
    ...corridas.map(
      (fila) =>
        `| ${fila.id} | ${fila.origen} | ${fila.titulo} | ${fila.esperado} | ${fila.predicho} |`,
    ),
  ];
  const precision = matriz.etiquetas
    .map((clase) => `| ${clase} | ${pct(matriz.precision[clase])} | ${matriz.soporte_esperado[clase]} |`)
    .join("\n");
  const markdown = [
    "# Métrica 3 — precisión del auditor",
    "",
    "Los 10 escenarios de D2 se vuelven a ejecutar con los mismos fixtures (`tests/auditor/ayuda.ts`). Los 10 de F1 están en `evaluacion/escenarios_extra.ts` y en `tests/evaluacion/auditor_extra.test.ts`. El auditor corre en un puerto efímero, con `relevo_lector`, sin redactar razones con el modelo.",
    "",
    `Aciertos ${aciertos}/${corridas.length}. La etiqueta dorada es la clase que las reglas de D2 deben devolver en ese caso. Una precisión de 1.00 en esta tabla significa que el auditor sigue esas reglas, no que un humano independiente haya rotulado los casos.`,
    "",
    ...tabla,
    "",
    "## Precisión por clase",
    "",
    "| clase | precisión | soporte esperado |",
    "|---|---:|---:|",
    precision,
    "",
    "## Matriz de confusión",
    "",
    "Filas = esperado, columnas = predicho.",
    "",
    tablaMatriz(matriz),
    "",
    "El seed tiene 0 empleados con `activo = false`. `f1-no-activo` usa el id 999998, que `listar_empleados(activo=true)` trata igual que un inactivo: «no existe o no está activo». No se escribió en `empleados`.",
    "",
    "`f1-noche-hacia-domingo` es la noche del sábado 2026-10-03. El auditor cuenta esas horas en la fecha de la asignación y observa el recargo nocturno; no marca el domingo en el que amanece. `f1-reyes-calendario` (2026-01-06) no es festivo en el catálogo Emiliani; el lunes 2026-01-12 sí. `f1-ausencia-sin-turno` cruza dos semanas y, como no pisa turnos, queda aprobada. `f1-pasa-44` suma la mañana del 8 de agosto a las cinco noches de Mónica Vargas Restrepo (empleado 12): 48 h, por encima de las 44. `f1-reemplazo` le quita a Blanca Becerra el domingo 16 de agosto y le asigna el lunes 10: ese lunes cae en su incapacidad aprobada del 7 al 10, y el auditor rechaza.",
    "",
  ].join("\n");

  mkdirSync(path.dirname(SALIDA_JSON), { recursive: true });
  writeFileSync(SALIDA_MD, markdown, "utf8");
  writeFileSync(
    SALIDA_JSON,
    `${JSON.stringify({ n: corridas.length, aciertos, matriz, corridas }, null, 2)}\n`,
    "utf8",
  );
  console.log(markdown);
}

function esEntradaPrincipal(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(argv1)).href;
}

if (esEntradaPrincipal()) {
  evaluarAuditor().catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : "falló la evaluación";
    console.error(mensaje);
    process.exit(1);
  });
}
