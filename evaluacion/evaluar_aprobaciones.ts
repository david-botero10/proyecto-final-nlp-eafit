/**
 * Lee propuestas, aprobaciones y pares. No escribe nómina.
 * Separa usuario=simulador de cualquier otro usuario.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crearCliente } from "../lib/db/cliente";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA_MD = path.join(RAIZ, "evaluacion", "aprobaciones.md");
const SALIDA_JSON = path.join(RAIZ, "evaluacion", "resultados", "aprobaciones.json");

type Conteo = { clave: string; n: number };

function pct(numerador: number, denominador: number): string {
  if (denominador === 0) {
    return "sin casos";
  }
  return `${((numerador / denominador) * 100).toFixed(2)} % (${numerador}/${denominador})`;
}

function tabla(encabezado: string, filas: Conteo[]): string {
  const cuerpo = filas.map((fila) => `| ${fila.clave} | ${fila.n} |`);
  return [`| ${encabezado} | n |`, "|---|---:", ...cuerpo].join("\n");
}

export async function evaluarAprobaciones(): Promise<void> {
  const cliente = crearCliente();
  try {
    await cliente.sql`SET ROLE relevo_lector`;
    const porEstado = await cliente.sql<{ estado: string; n: number }[]>`
      SELECT estado, COUNT(*)::int AS n
      FROM propuestas
      GROUP BY estado
      ORDER BY estado
    `;
    const porUsuarioEstado = await cliente.sql<
      { grupo: string; estado: string; n: number }[]
    >`
      SELECT
        CASE WHEN usuario = 'simulador' THEN 'simulador' ELSE 'humano' END AS grupo,
        estado,
        COUNT(*)::int AS n
      FROM propuestas
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;
    const porDecision = await cliente.sql<{ decision: string; n: number }[]>`
      SELECT decision, COUNT(*)::int AS n
      FROM aprobaciones
      GROUP BY decision
      ORDER BY decision
    `;
    const porOrigen = await cliente.sql<{ grupo: string; origen: string; n: number }[]>`
      SELECT
        CASE WHEN pr.usuario = 'simulador' THEN 'simulador' ELSE 'humano' END AS grupo,
        pp.origen,
        COUNT(*)::int AS n
      FROM pares_preferencia AS pp
      JOIN propuestas AS pr ON pr.id = pp.propuesta_id
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;
    const totales = await cliente.sql<{ grupo: string; n: number }[]>`
      SELECT
        CASE WHEN usuario = 'simulador' THEN 'simulador' ELSE 'humano' END AS grupo,
        COUNT(*)::int AS n
      FROM propuestas
      GROUP BY 1
      ORDER BY 1
    `;

    const nDe = (grupo: string, estado: string) =>
      porUsuarioEstado.find((fila) => fila.grupo === grupo && fila.estado === estado)?.n ??
      0;
    const totalGrupo = (grupo: string) =>
      totales.find((fila) => fila.grupo === grupo)?.n ?? 0;
    const decididas = (grupo: string) =>
      porUsuarioEstado
        .filter((fila) => fila.grupo === grupo && fila.estado !== "pendiente")
        .reduce((suma, fila) => suma + fila.n, 0);

    const resumen = {
      propuestas_por_estado: porEstado,
      propuestas_por_usuario_estado: porUsuarioEstado,
      aprobaciones_por_decision: porDecision,
      pares_por_origen: porOrigen,
      tasa_sin_correccion: {
        simulador: {
          aprobadas: nDe("simulador", "aprobada"),
          decididas: decididas("simulador"),
          total: totalGrupo("simulador"),
        },
        humano: {
          aprobadas: nDe("humano", "aprobada"),
          decididas: decididas("humano"),
          total: totalGrupo("humano"),
        },
      },
    };

    const sim = resumen.tasa_sin_correccion.simulador;
    const humano = resumen.tasa_sin_correccion.humano;
    const notaHumanos =
      humano.total === 0
        ? "No hay propuestas de usuarios humanos. La tasa humana queda pendiente hasta las sesiones del protocolo (`evaluacion/PROTOCOLO_USUARIOS.md`). Hoy el numerador y el denominador son 0."
        : `Humanos: aprobación sin corrección ${pct(humano.aprobadas, humano.decididas)} sobre propuestas ya decididas.`;

    const markdown = [
      "# Métrica 4 — tasa de aprobación humana y regresión entre versiones",
      "",
      "Consulta de solo lectura (`SET ROLE relevo_lector`) sobre `propuestas`, `aprobaciones` y `pares_preferencia`. La tasa sin corrección es `estado = aprobada` dividido por las propuestas cuyo estado no es `pendiente`. `corregida` cuenta como decisión humana distinta: hubo tarjeta, pero el texto se cambió. El usuario `simulador` sale de `propuestas.usuario`; los pares no guardan usuario y se clasifican con el join.",
      "",
      "## Propuestas por estado",
      "",
      tabla(
        "estado",
        porEstado.map((fila) => ({ clave: fila.estado, n: fila.n })),
      ),
      "",
      "## Por origen de la decisión",
      "",
      tabla(
        "usuario / estado",
        porUsuarioEstado.map((fila) => ({
          clave: `${fila.grupo} / ${fila.estado}`,
          n: fila.n,
        })),
      ),
      "",
      "## Aprobaciones",
      "",
      tabla(
        "decisión",
        porDecision.map((fila) => ({ clave: fila.decision, n: fila.n })),
      ),
      "",
      "## Pares de preferencia",
      "",
      tabla(
        "usuario / origen",
        porOrigen.map((fila) => ({
          clave: `${fila.grupo} / ${fila.origen}`,
          n: fila.n,
        })),
      ),
      "",
      "## Tasas",
      "",
      `Simulador: aprobación sin corrección ${pct(sim.aprobadas, sim.decididas)}. Es señal fabricada por \`data/ordenes/simular_decisiones.py\`, no una sesión con personas. No sirve para decir que el sistema ya convence a un coordinador.`,
      "",
      notaHumanos,
      "",
      "Para la regresión entre versiones, el mismo SQL se vuelve a correr después de las sesiones. Los pares con `origen = correccion` son el lote que alimentó el DPO; los de `origen = aprobacion` quedaron fuera de ese entrenamiento. Una subida de la tasa humana sin corrección, de una sesión a la siguiente, sería la señal de que la versión nueva se equivoca menos. Con cero filas humanas esa comparación todavía no existe.",
      "",
      "Vuelve a medirlo con `npm run eval:aprobaciones`.",
      "",
    ].join("\n");

    mkdirSync(path.dirname(SALIDA_JSON), { recursive: true });
    writeFileSync(SALIDA_MD, markdown, "utf8");
    writeFileSync(SALIDA_JSON, `${JSON.stringify(resumen, null, 2)}\n`, "utf8");
    console.log(markdown);
  } finally {
    await cliente.cerrar();
  }
}

function esEntradaPrincipal(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(argv1)).href;
}

if (esEntradaPrincipal()) {
  evaluarAprobaciones().catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : "falló la evaluación";
    console.error(mensaje);
    process.exit(1);
  });
}
