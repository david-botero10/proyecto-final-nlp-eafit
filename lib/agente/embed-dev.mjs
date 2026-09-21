import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const windows = process.platform === "win32";
const python = path.resolve(
  raiz,
  "..",
  "relevo-ml-venv",
  windows ? "Scripts/python.exe" : "bin/python",
);

if (!existsSync(python)) {
  console.error(
    "No está el venv de ML en ../relevo-ml-venv. Créalo fuera del repo e instala ml/requirements.txt.",
  );
  process.exit(1);
}

const hijo = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "servir:app",
    "--app-dir",
    "ml",
    "--host",
    "127.0.0.1",
    "--port",
    "8631",
  ],
  {
    cwd: raiz,
    stdio: "inherit",
    env: { ...process.env, CUDA_VISIBLE_DEVICES: "" },
  },
);

hijo.on("exit", (codigo) => {
  process.exit(codigo ?? 1);
});
