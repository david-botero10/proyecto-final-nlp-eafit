import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const raiz = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/web/setup.ts"],
    include: ["tests/web/**/*.test.{ts,tsx}", "tests/mcp/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": raiz,
    },
  },
});
