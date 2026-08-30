# Spec A1 — web-skeleton (Next.js 15 + AI SDK, chat vacío)

Ola A1 de Relevo (semana 2). Lee antes: `docs/ARQUITECTURA.md` (§2, §5, §9),
`docs/PLAN_DESARROLLO.md`, `CLAUDE.md`.

## Objetivo

Esqueleto del chat web funcionando **sin ningún modelo de lenguaje**: página de
chat en español que conversa contra un stream simulado. Deja lista la
infraestructura de calidad (ESLint, Vitest, TypeScript estricto) que usarán
todas las olas siguientes.

## Archivos que PUEDES tocar (nada más)

- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`,
  `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`,
  `next-env.d.ts`, `.prettierrc` (opcional)
- `app/**`, `components/**`, `lib/**`, `public/**`, `tests/web/**`
- `docs/orca/reports/A1_WEB_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `db/`, `data/`, `ml/`, `corpus/`, `mcp/`,
`docker-compose.yml`, `README.md`, `CLAUDE.md`, `docs/*.md`. Otras olas corren
en paralelo sobre esos archivos.

## Requisitos

1. **Stack**: Next.js 15 (App Router, TypeScript estricto, sin `src/`, alias
   `@/*`), React 19, Tailwind CSS 4, Vercel AI SDK 5 (`ai`, `@ai-sdk/react`).
   Node 24. Tienes skills locales `nextjs-15`, `ai-sdk-5`, `react-19`,
   `tailwind-4`, `typescript`, `zod-4`: úsalas.
2. **Página de chat** (`app/page.tsx` + `components/chat.tsx`):
   - `useChat` de `@ai-sdk/react` contra `/api/chat`.
   - UI en español: encabezado «Relevo», subtítulo «Asistente de turnos y
     ausencias», input con placeholder «Escribe una orden o pregunta…», burbujas
     usuario/asistente, indicador de «pensando», estado vacío con 3 ejemplos de
     preguntas colombianas.
   - Diseño sobrio con Tailwind; sin librerías de componentes.
3. **`app/api/chat/route.ts`**: sin LLM. Usa `simulateReadableStream` +
   `createUIMessageStreamResponse` (AI SDK 5) para responder un mensaje fijo:
   «Soy Relevo. Aún no tengo modelo conectado (llega en la semana 3), pero mi
   interfaz ya funciona. Me preguntaste: "<último mensaje del usuario>"».
   La ruta valida el body con Zod y responde 400 ante body inválido.
4. **`lib/tipos.ts`**: tipos compartidos del dominio que ya define la
   arquitectura (Turno `"M"|"T"|"N"`, `Extraccion`, `Accion`, `Propuesta`,
   `VeredictoAuditor`) copiando los contratos de `docs/ARQUITECTURA.md` §4.
5. **Calidad**:
   - ESLint 9 flat config (`next/core-web-vitals` + TS).
   - Vitest + Testing Library: al menos 4 tests — la página renderiza el
     encabezado; el input envía mensajes; `/api/chat` responde stream con el
     texto esperado; `/api/chat` responde 400 con body inválido.
   - Scripts npm: `dev`, `build`, `lint`, `test` (`vitest run`).
6. **Sin secretos, sin `.env`** (esta ola no los necesita). UTF-8 sin BOM.
   Textos de UI y comentarios en español.

## Gates (en ESTE worktree, uno a la vez)

```
npm run lint && npm test && npm run build
```

## Entrega

- Reporte `docs/orca/reports/A1_WEB_REPORT.md`: qué se hizo, decisiones,
  salida LITERAL de los tres gates, hash del commit.
- Commit único: `feat(web): esqueleto Next.js 15 + AI SDK con chat simulado (A1)`
- Sin push, sin merge, sin PR.
