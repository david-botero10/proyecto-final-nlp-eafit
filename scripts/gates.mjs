/**
 * Encadena las partes TS y Python de los gates `lint` y `test`.
 * Si una parte falla, dice cuál fue y con qué comando reproducirla.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pythonDelVenv() {
  const win = path.join(raiz, ".venv", "Scripts", "python.exe");
  const nix = path.join(raiz, ".venv", "bin", "python");
  if (existsSync(win)) return win;
  if (existsSync(nix)) return nix;
  return "python";
}

function citar(parte) {
  return /[\s"]/.test(parte) ? `"${parte.replaceAll('"', '\\"')}"` : parte;
}

function reproducirHumano(python, reproducir) {
  return reproducir.replaceAll("{python}", citar(python));
}

/**
 * @param {{
 *   etiqueta: string,
 *   comando: string,
 *   args: string[],
 *   reproducir: string,
 * }} paso
 */
function ejecutar(paso) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(paso.comando, paso.args, {
      cwd: raiz,
      stdio: "inherit",
      env: process.env,
    });
    hijo.on("error", (err) => {
      reject(Object.assign(err, { paso }));
    });
    hijo.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const error = new Error(
        signal ? `señal ${signal}` : `código ${code ?? 1}`,
      );
      error.paso = paso;
      error.codigo = code ?? 1;
      reject(error);
    });
  });
}

async function encadenar(pasos) {
  for (const paso of pasos) {
    try {
      await ejecutar(paso);
    } catch (err) {
      const paso = err.paso ?? { etiqueta: "desconocido", reproducir: "" };
      console.error(`\n[gates] Falló: ${paso.etiqueta}`);
      if (err.codigo == null && err.message) {
        console.error(`[gates] ${err.message}`);
      }
      console.error(`[gates] Reproduce con: ${paso.reproducir}`);
      process.exit(typeof err.codigo === "number" ? err.codigo : 1);
    }
  }
}

const gate = process.argv[2];
const python = pythonDelVenv();
const node = process.execPath;
const eslintJs = path.join(raiz, "node_modules", "eslint", "bin", "eslint.js");
const vitestJs = path.join(raiz, "node_modules", "vitest", "vitest.mjs");

if (gate === "lint") {
  await encadenar([
    {
      etiqueta: "ESLint (TypeScript)",
      comando: node,
      args: [eslintJs, "."],
      reproducir: "npx eslint .",
    },
    {
      etiqueta: "ruff (db, data, ml)",
      comando: python,
      args: [
        "-m",
        "ruff",
        "check",
        "db",
        "data",
        "ml",
        "--target-version",
        "py311",
      ],
      reproducir: reproducirHumano(
        python,
        "{python} -m ruff check db data ml --target-version py311",
      ),
    },
  ]);
} else if (gate === "test") {
  await encadenar([
    {
      etiqueta: "vitest (TypeScript)",
      comando: node,
      args: [vitestJs, "run"],
      reproducir: "npx vitest run",
    },
    {
      etiqueta: "pytest (db/tests)",
      comando: python,
      args: ["-m", "pytest", "db/tests"],
      reproducir: reproducirHumano(python, "{python} -m pytest db/tests"),
    },
    {
      etiqueta: "pytest (ml/tests)",
      comando: python,
      args: ["-m", "pytest", "ml/tests"],
      reproducir: reproducirHumano(python, "{python} -m pytest ml/tests"),
    },
  ]);
} else {
  console.error("Uso: node scripts/gates.mjs <lint|test>");
  process.exit(2);
}
