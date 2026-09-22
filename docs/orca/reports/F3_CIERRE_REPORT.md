# Reporte F3 — cierre editorial

Worktree `f3-cierre`, rama `david-botero10/f3-cierre`, base `de502a4` (el mismo commit que `main` al empezar). No hay push, PR ni merge. La base de `localhost:5432` no se apagó ni se re-sembró. No se tocó código, tests, `evaluacion/`, `.gitignore` ni ningún archivo fuera de la lista de la spec.

La sesión corre como Grok 4.7. No se bajó el modelo ni el esfuerzo de razonamiento. El modelo de chat del producto sigue siendo `grok-4.6`.

## Qué se completó

F2 dejó marcadores `[E2: …]` y `[F1: …]` porque esas olas todavía no estaban en el árbol. Ahora los reportes y los JSON de `evaluacion/resultados/` sí están. Cada hueco se sustituyó por la cifra publicada, con su fuente. Donde la corrida no existe, el texto dice pendiente: la columna Grok y el juez de citas (no había `XAI_API_KEY`), y las sesiones con personas (0 filas humanas). No se rellenó ninguno de esos tres huecos.

El contraste léxico de una primera corrida de F1 (recall 12,5 %, MRR 0,150) no está en `docs/orca/reports/F1_EVALUACION_REPORT.md` ni en `evaluacion/resultados/citas.json` (20 híbrida, 0 léxica). No se cita.

## Marcadores sustituidos

| Dónde estaba | Antes | Después | Fuente |
|---|---|---|---|
| Informe, párrafo de apertura | El hueco queda como marcador para el orquestador | Las cifras salen de los reportes E2 y F1; clave y sesiones siguen en pendiente | E2, F1 |
| Informe §1, delta DPO | Marcador de tabla con intervalos; «el reporte E2 no está en este árbol» | v1 76,92 % IC [66,15 %, 87,69 %]; v2 83,08 % IC [73,85 %, 90,77 %]; +6,15 pp; los intervalos se solapan | `E2_DPO_REPORT.md`, `evaluacion/resultados/extraccion.json` |
| Informe §1, usuarios | Marcador de sesiones | Pendiente de sesiones. El protocolo está en `evaluacion/PROTOCOLO_USUARIOS.md` | `F1_EVALUACION_REPORT.md` |
| Informe §4.2 | El servicio del extractor no está en este árbol | `ml/servir_extractor.py`, `npm run extractor:dev`, puerto 8642, v2 por defecto. Humo: Ana Mery Montoya Patiño, N, 2026-10-12, `asignar`; 69,087 s / 11,098 s | `E2_DPO_REPORT.md` |
| Informe §5.3 | Marcador de recall y juez | Modo híbrido, 20 preguntas: recall@3 97,50 %, @5 100 %, @8 100 %, MRR 0,933. Juez pendiente | `evaluacion/resultados/citas.json`, `evaluacion/citas.md` |
| Informe §5.5 | Marcadores de intervalos, v2 y columna Grok | Tabla base \| v1 \| v2 con delta. IC bootstrap de 1 000 remuestreos. Grok pendiente. v1 50/65, v2 54/65 | `ml/runs/comparacion.md`, `extraccion.json` |
| Informe §6.4 | «El código de ese simulador no está en este árbol» | `data/ordenes/simular_decisiones.py`: 120 órdenes, 91 aprobaciones, 29 correcciones, 29 pares DPO, 0 SFT | `E2_DPO_REPORT.md` |
| Informe §7 | Marcadores de loss, rewards y delta por campo | Loss del paso 1: 0,6931471824645996. `loss_final`: 0,5862218737602234. `rewards/accuracies`: 0,6875. Segundos: 206,434. VRAM pico: 8 428,99 MiB. Lectura: el DPO corrigió la acción, no el calendario | `metricas.json` literal en `E2_DPO_REPORT.md` |
| Informe §8.1 | Marcadores de intervalo, Grok y subgrupos | Intervalos publicados. Grok pendiente. Tabla de relativas, absolutas (n = 5, total 0 %), sin fecha, `quitar` (acción 50 % → 90 %, total 50 % → 70 %) y resto | `evaluacion/extraccion.md` |
| Informe §8.2 | Marcador de las 20 preguntas y del juez | Las cifras de §5.3, más c16, c18 y c20 fuera del primer puesto o del top 3 | `evaluacion/citas.md` |
| Informe §8.3 | Marcador de precisión y matriz, con 10 trampas | 20/20. Precisión 100 % en aprobado (3), observaciones (9) y rechazado (8). Matriz diagonal. Las 10 trampas `f1-*` listadas | `evaluacion/resultados/auditor.json`, `evaluacion/auditor.md` |
| Informe §8.4 | Marcador de tasa humana, tabla única y regresiones | Simulador 75,83 % (91/120). Humanos: 0. La tabla base → v1 → v2 está en `ml/runs/comparacion.md`, fuera de Phoenix | `aprobaciones.json`, E2, F1 |
| Informe §8.5 | «El protocolo no está en el árbol» y marcador de sesiones | Protocolo, Likert y `evaluacion/sesiones/plantilla.csv` sí están. Sesiones: pendiente | `evaluacion/PROTOCOLO_USUARIOS.md`, F1 |
| Informe §10.4 | «No hay un reporte que explique el reindexado» | Commit `a21a6d6`: UTF-8 con BOM de Función Pública. Vigente: 20 documentos / 589 chunks. B2 (18/497) queda histórica | Mensaje de `a21a6d6` |
| Informe, anexo B | Marcadores de los comandos de eval y del extractor | `npm run eval:extraccion`, `eval:citas`, `eval:auditor`, `eval:aprobaciones`, `ml/comparar_versiones.py`, `npm run extractor:dev` | `package.json`, E2, F1 |
| Informe, anexo C | `evaluacion/` prevista y ausente | `evaluacion/` y `ml/dpo/` en la estructura | Árbol de este worktree |
| README, tabla | Marcadores de delta y de sesiones; extractor ausente | Mismas cifras finales (v2, citas, auditor 20/20, aprobación, corpus 20/589) y el servicio en el puerto 8642 | E2, F1, `a21a6d6` |
| README, cómo reproducir | Marcadores de cada métrica | Comandos `npm run eval:*` y el protocolo. Grok, juez y sesiones siguen en la columna de lo que falta | `evaluacion/README.md` |
| Presentación, notas de RAG | Marcador de recall y juez | 97,50 % / 100 % / 100 % / MRR 0,933. Juez pendiente | F1 |
| Presentación, notas del auditor | Marcador de matriz | 20/20, precisión 100 %, matriz diagonal, trampas en el informe §8.3 | F1 |
| Presentación, diapositiva DPO | Marcador del delta | 76,92 % → 83,08 % (+6,15 pp) e intervalos. Notas: loss 0,693 → 0,586, `rewards/accuracies` 0,6875, 206,434 s, 8 428,99 MiB. La acción `quitar` 50 % → 90 % | E2 |
| Presentación, evaluación y cierre | «Falta el delta de DPO» y la frase de marcadores | La tabla de las cuatro métricas con lo medido y lo pendiente. El cierre deja Grok y las sesiones | E2, F1 |
| Guion, plan B | La tabla oral era solo 3,08 % → 76,92 % | 3,08 % → 76,92 % → 83,08 %, y sigue sin comparar contra Grok | C3, E2 |

## HTML

Mismo método que F2: el Markdown va en `<script type="text/plain">` y lo renderizan marked 15.0.7 y mermaid 10.9.3. La presentación usa reveal.js 5.1.0 desde cdnjs, tema `white`, notas con la tecla S. Se regeneraron `docs/entrega/S5_informe.html` y `docs/entrega/S5_presentacion.html` desde `informe/INFORME_FINAL.md` y `informe/PRESENTACION.md`.

Servidor local: `python -m http.server 8873 --bind 127.0.0.1`, desde la raíz del worktree. Se apagó al terminar la comprobación.

`curl.exe` devolvió HTTP 200 para los dos archivos (70 678 y 12 957 bytes). Los CDN de reveal.js 5.1.0 (`reveal.min.js`, `theme/white.min.css`, `plugin/notes/notes.min.js`), marked 15.0.7 y mermaid 10.9.3 respondieron 200.

En el navegador de Orca:

- `S5_informe.html` renderizó el título «Relevo — Informe técnico final (Semana 5, SI7016)». El texto «Cargando…» ya no estaba. Un SVG de mermaid. El cuerpo muestra `83,08` y la loss literal `0,5862218737602234`. Consola vacía.
- `S5_presentacion.html` cargó reveal.js. 15 secciones. `Reveal.next()` dejó el índice horizontal en 1, título «El problema». Un SVG de mermaid. El HTML de las diapositivas contiene `83,08`. Consola vacía.

No se comprobó un viewport de móvil aparte: las dos páginas se abrieron en el ancho del navegador de Orca. La plantilla de estilos no se cambió.

## Preparación que no es gate

`grep` no está en el PATH de PowerShell. El binario usado es el de Git, `usr\bin\grep.exe`, con el patrón de la spec. `npm ci` (exit 0, 575 paquetes) dejó `node_modules/` en este worktree; no se comitea. El `.venv` es una unión al del repositorio principal (Python 3.11.16, ruff 0.16.5); tampoco se comitea.

```text
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 575 packages, and audited 576 packages in 51s

189 packages are looking for funding
  run `npm fund` for details

9 vulnerabilities (7 moderate, 2 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

## Gates

Uno por uno, en este worktree. Los tres de npm salieron con exit 0.

### `grep -rnE "\[E2:|\[F1:" informe README.md`

Sin líneas. Exit 1 de GNU grep: no hubo coincidencias. `informe/` incluye el informe, la presentación y el guion.

### `npm run lint`

```text
> relevo@0.1.0 lint
> node scripts/gates.mjs lint

All checks passed!
```

Exit 0. ESLint no imprimió hallazgos. La línea verde es ruff (`db`, `data`, `ml`), con color ANSI en la terminal.

### `npm test`

```text
> relevo@0.1.0 test
> node scripts/gates.mjs test


 RUN  v4.1.11 C:/Users/davbo/orca/workspaces/Proyecto Final NLP 2026/f3-cierre


 Test Files  23 passed (23)
      Tests  102 passed (102)
   Start at  23:05:34
   Duration  48.36s (transform 6.45s, setup 108.65s, import 104.28s, tests 6.73s, environment 297.78s)

============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f3-cierre\db
configfile: pyproject.toml
plugins: anyio-4.14.2, Faker-40.37.0
collected 6 items

db\tests\test_esquema.py ......                                          [100%]

============================== 6 passed in 0.77s ==============================
============================= test session starts =============================
platform win32 -- Python 3.11.16, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f3-cierre\ml
configfile: pyproject.toml
plugins: anyio-4.14.2, Faker-40.37.0
collected 49 items

ml\tests\test_chunking.py ......                                         [ 12%]
ml\tests\test_dpo_comparar.py ....                                       [ 20%]
ml\tests\test_dpo_pares.py ......                                        [ 32%]
ml\tests\test_dpo_simulador.py .....                                     [ 42%]
ml\tests\test_evals.py .                                                 [ 44%]
ml\tests\test_extractor.py ......                                        [ 57%]
ml\tests\test_manifiesto.py ....                                         [ 65%]
ml\tests\test_ordenes.py .............                                   [ 91%]
ml\tests\test_servir_extractor.py ..                                     [ 95%]
ml\tests\test_sin_bd.py ..                                               [100%]

============================== warnings summary ===============================
.venv\Lib\site-packages\fastapi\testclient.py:1
  C:\Users\davbo\orca\workspaces\Proyecto Final NLP 2026\f3-cierre\.venv\Lib\site-packages\fastapi\testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 49 passed, 1 warning in 2.04s ========================
```

Exit 0. 102 tests de Vitest, 6 de `db/tests`, 49 de `ml/tests`. El aviso de Starlette sobre `httpx` y `TestClient` ya estaba en E2 y en F1.

### `npm run build`

```text
> relevo@0.1.0 build
> next build

   ▲ Next.js 15.5.24

   Creating an optimized production build ...
 ⚠ Compiled with warnings in 12.2s

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

 ✓ Compiled successfully in 32.0s
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
├ ○ /_not-found                            995 B         104 kB
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

El hash del commit único es la salida de `git rev-parse HEAD` en este worktree (rama `david-botero10/f3-cierre`). No se enmienda el commit para incrustar el SHA.
