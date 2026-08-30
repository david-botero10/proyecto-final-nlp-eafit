# Reporte A1 — web-skeleton

Worktree: `a1-web` (`david-botero10/a1-web`), base `6aa99d8`.

## Qué se hizo

Esqueleto del chat web de Relevo **sin modelo de lenguaje ni base de datos**:

- Next.js 15 (App Router, TypeScript estricto, alias `@/*`, sin `src/`), React 19, Tailwind CSS 4, AI SDK 5 (`ai` + `@ai-sdk/react`) y Zod 4.
- Página de chat en español (`app/page.tsx` + `components/chat.tsx`) con `useChat` contra `/api/chat`.
- Ruta `app/api/chat/route.ts` que valida el body con Zod y responde un stream simulado (`simulateReadableStream` + `createUIMessageStreamResponse`).
- Tipos de dominio en `lib/tipos.ts` copiados de `docs/ARQUITECTURA.md` §4 (`Turno`, `Extraccion`, `Accion`, `Propuesta`, `VeredictoAuditor`).
- ESLint 9 flat (`next/core-web-vitals` + `next/typescript`) y Vitest + Testing Library (4 tests en `tests/web/`).

No se tocó `.gitignore`, `db/`, `data/`, `ml/`, `corpus/`, `mcp/`, `docker-compose.yml`, `README.md`, `CLAUDE.md` ni `docs/*.md`. Sin secretos ni `.env`.

## Decisiones

- Stream simulado con chunks `UIMessageChunk` (no LLM). El texto fijo replica el de la spec, interpolando el último mensaje del usuario.
- Body inválido (JSON roto, schema Zod o sin texto de usuario) → HTTP 400.
- TypeScript 5.9: TypeScript 6 rompe el import de `globals.css` en Next 15.
- `"type": "module"` para que Vitest cargue `vitest.config.ts` como ESM.
- `next-env.d.ts` queda fuera de ESLint: Next lo regenera con un triple-slash que `@typescript-eslint/triple-slash-reference` rechaza.
- El warning de webpack `Critical dependency` en `@ai-sdk/provider-utils` viene de `node_modules` al importar `ai`; no es código de esta ola.

## Gates (literales, uno a la vez)

### `npm run lint`

```
> relevo@0.1.0 lint
> eslint .

```

Salida vacía. Código de salida 0.

### `npm test`

```
> relevo@0.1.0 test
> vitest run


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/a1-web


 Test Files  3 passed (3)
      Tests  4 passed (4)
   Start at  14:42:14
   Duration  13.97s (transform 793ms, setup 4.61s, import 5.43s, tests 2.33s, environment 22.05s)
```

Código de salida 0.

### `npm run build`

```
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 3.5s

./node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/ai/dist/index.mjs
./app/api/chat/route.ts

 ✓ Compiled successfully in 7.8s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/5) ...
   Generating static pages (1/5) 
   Generating static pages (2/5) 
   Generating static pages (3/5) 
 ✓ Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                    59.9 kB         162 kB
├ ○ /_not-found                            995 B         104 kB
└ ƒ /api/chat                              123 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.97 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Código de salida 0.

## Hash del commit

`b5eb6f1d07cc829e900769dcef0ea31cfdd15a1f`

Confirmar en este worktree con `git rev-parse HEAD` (rama `david-botero10/a1-web`).
