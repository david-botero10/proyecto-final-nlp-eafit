# Reporte F2 — entrega

Worktree `f2-entrega`, rama `david-botero10/f2-entrega`, base `8f81eb1` (mismo commit que `main` al empezar: specs de la ola F). No hay push, PR ni merge. La base de `localhost:5432` no se apagó ni se re-sembró. Phoenix, que ya estaba en el puerto 6006, tampoco se tocó.

La sesión corre como Grok 4.7. No se bajó el modelo ni el esfuerzo de razonamiento. El modelo de chat del producto sigue siendo `grok-4.6`.

## Qué se produjo

| Archivo | Qué es |
|---|---|
| `informe/INFORME_FINAL.md` | Informe técnico. Unas 8 800 palabras. Rúbrica → evidencia, diez secciones pedidas, anexos |
| `informe/PRESENTACION.md` | 15 diapositivas separadas por `---`, con notas del orador |
| `informe/GUION_DEMO.md` | Demo de 8 minutos, checklist de 10 puntos, plan B |
| `informe/figuras/componentes.md` | Mermaid de componentes, reutilizado en el informe |
| `docs/entrega/S5_informe.html` | El informe con la plantilla de `S2_arquitectura.html` (marked 15.0.7, mermaid 10.9.3, estilos de impresión) |
| `docs/entrega/S5_presentacion.html` | reveal.js 5.1.0 desde cdnjs, tema `white`, notas con la tecla S |
| `README.md` | Portada del proyecto entregado |
| `LICENSE` | MIT, equipo del curso |
| `docs/orca/reports/F2_ENTREGA_REPORT.md` | Este reporte |

No se tocó código (`app/`, `lib/`, `mcp/`, `auditor/`, `ml/`, `db/`, `data/`, `tests/`), `.gitignore`, `docs/ARQUITECTURA.md`, `docs/PLAN_DESARROLLO.md` ni `evaluacion/`.

## Qué no está en este árbol

E2 no tiene reporte ni código (`ml/dpo/`, `ml/servir_extractor.py` no existen). F1 no tiene carpeta `evaluacion/` ni reporte. El informe deja el hueco con marcadores, no con cifras inventadas.

Hay una fotografía de solo lectura del 21 de septiembre de 2026 (anexo A del informe) que no es un reporte de ola: 20 documentos, 589 chunks, 120 pares del `simulador` (91 aprobación, 29 corrección), 0 decisiones de personas, 0 filas `origen = 'tarjeta'`. B2 sigue diciendo 18 documentos y 497 chunks: esa fue la indexación de esa ola. La base de hoy ya incluye Ley 2101 y Ley 2466.

## Marcadores pendientes

Para que el orquestador los complete cuando F1 y E2 aterricen:

- [F1: sesiones de usuario]
- [F1: exactitud base | v1 | v2 | Grok con intervalos bootstrap]
- [F1: intervalo bootstrap de 1 000 remuestreos]
- [F1: columna Grok]
- [F1: subgrupos de extracción]
- [F1: recall@3, recall@5, recall@8 y MRR; juez de fidelidad 0–1]
- [F1: 20 preguntas doradas, recall@3, recall@5, recall@8, MRR, y fidelidad 0–1]
- [F1: precisión por clase y matriz 3×3, con 10 trampas adicionales]
- [F1: tasa de aprobación humana, separada de `usuario = 'simulador'`]
- [F1: regresiones]
- [F1: `npm run eval:extraccion`]
- [F1: `evaluacion/evaluar_citas.ts`]
- [F1: `npm run eval:aprobaciones`]
- [E2: tabla base | v1 | v2 con intervalos]
- [E2: tabla base | v1 | v2 con delta e intervalos]
- [E2: delta v1→v2 por campo, con intervalo]
- [E2: loss, rewards/accuracies y segundos de extractor-v2]
- [E2: subgrupos]
- [E2: tabla única]
- [E2: `ml/comparar_versiones.py` y `npm run extractor:dev`]

La presentación y el README repiten el mismo hueco con formulaciones más cortas (`[F1: recall y juez]`, `[F1: matriz 3×3]`, `[F1: sesiones]`, `[E2: delta v1 → v2 con intervalo]`, `[E2: tabla con intervalos]`).

## HTML

Servidor local: `python -m http.server 8765 --bind 127.0.0.1`, desde la raíz del worktree.

`curl.exe` devolvió HTTP 200 para los dos archivos (61 516 y 11 706 bytes). Los CDN de reveal.js 5.1.0 (`reveal.min.js`, `theme/white.min.css`, `plugin/notes/notes.min.js`) respondieron 200.

En el navegador de Orca:

- `S5_informe.html` renderizó el título y el cuerpo. Un bloque mermaid, un SVG. El texto «Cargando…» ya no estaba. Consola vacía.
- `S5_presentacion.html` cargó reveal.js. `Reveal.getIndices` tras `Reveal.next()` pasó a la diapositiva 1, título «El problema». 15 secciones. Un SVG de mermaid. Consola vacía.

No se comprobó un viewport de móvil aparte: las dos páginas se abrieron en el ancho del navegador de Orca.

## Gates

Uno por uno, en este worktree, con la base ya activa. Antes, y sin formar parte del gate: `npm ci` (exit 0, 575 paquetes) y un `.venv` nuevo con Python 3.11.16 más `requirements-dev.txt` (no se commitea; está en `.gitignore`).

### `npm run lint`

```
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

Exit 0. ESLint no imprimió hallazgos. La línea verde es ruff (`db`, `data`, `ml`), con color ANSI en la terminal.

### `npm test`

```
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/f2-entrega


 Test Files  20 passed (20)
      Tests  83 passed (83)
   Start at  21:49:31
   Duration  34.22s (transform 4.65s, setup 78.90s, import 70.06s, tests 6.50s, environment 167.14s)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f2-entrega\db
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 0.75s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f2-entrega\ml
configfile: pyproject.toml
plugins: anyio-4.15.1, Faker-40.39.0
collected 31 items

ml\tests\test_chunking.py ......                                         [ 19%]
ml\tests\test_extractor.py ......                                        [ 38%]
ml\tests\test_manifiesto.py ....                                         [ 51%]
ml\tests\test_ordenes.py .............                                   [ 93%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================= 31 passed in 1.17s ==============================
```

Exit 0. 83 tests de Vitest, 6 de `db/tests`, 31 de `ml/tests`.

### `npm run build`

```
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 10.0s

./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/@ai-sdk/openai-compatible/dist/index.mjs
./node_modules/@ai-sdk/xai/dist/index.mjs
./lib/agente/modelo.ts
./lib/agente/asistente.ts
./lib/guardrails/escritura.ts

./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/xai/node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/@ai-sdk/xai/dist/index.mjs
./lib/agente/modelo.ts
./lib/agente/asistente.ts
./lib/guardrails/escritura.ts

./node_modules/@ai-sdk/provider-utils/dist/index.mjs
Critical dependency: the request of a dependency is an expression

Import trace for requested module:
./node_modules/@ai-sdk/provider-utils/dist/index.mjs
./node_modules/ai/dist/index.mjs
./app/api/chat/route.ts

 ✓ Compiled successfully in 25.0s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
   Generating static pages (1/4)
   Generating static pages (2/4)
   Generating static pages (3/4)
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                    63.9 kB         166 kB
├ ○ /_not-found                            993 B         104 kB
├ ƒ /api/chat                              133 B         103 kB
├ ƒ /api/perfil                            133 B         103 kB
├ ƒ /api/propuestas/[id]                   133 B         103 kB
└ ƒ /api/propuestas/[id]/decision          133 B         103 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-c5a697ddbf82d774.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.97 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Exit 0. El aviso de dependencia crítica sale de `@ai-sdk/xai` y de `ai` en `node_modules`. Esta ola no tocó esos imports.

## Hash

El hash del commit único es la salida de `git rev-parse HEAD` en este worktree (rama `david-botero10/f2-entrega`). No se enmienda el commit para incrustar el SHA.
