# Spec B2 — integracion (gates unificados, README, corpus indexado end-to-end)

Ola B2 de Relevo (semana 2, cierre del esqueleto). Lee antes:
`docs/ARQUITECTURA.md`, `docs/PLAN_DESARROLLO.md`, `CLAUDE.md`, y los reportes
de A1, A2, A3 y B1 en `docs/orca/reports/` (todo ya está fusionado en `main`).

## Objetivo

Que un compañero pueda clonar el repo y correrlo todo siguiendo el README, con
un solo juego de gates que cubra TypeScript y Python, y con el corpus normativo
**realmente indexado** en pgvector (la corrida completa que A3 dejó preparada).

## Archivos que PUEDES tocar (nada más)

- `README.md`, `.env.example`
- `package.json` (solo scripts; no toques dependencias), `package-lock.json`
  solo si un script lo exige (no debería)
- `scripts/**` (helpers de gates, p. ej. `scripts/gates.mjs`)
- `requirements-dev.txt` (raíz, nuevo: unión ligera para gates)
- `docs/orca/reports/B2_INTEGRACION_REPORT.md`

PROHIBIDO tocar: `.gitignore`, `app/`, `components/`, `lib/`, `mcp/`, `tests/`,
`db/`, `data/`, `ml/`, `corpus/*.json`, `docker-compose.yml`, `CLAUDE.md`,
`docs/*.md`, `docs/entrega/`.

## Requisitos

1. **Gates unificados** en `package.json`:
   - `npm run lint` → ESLint + `ruff check db data ml` (venv raíz).
   - `npm test` → `vitest run` + `pytest db/tests` + `pytest ml/tests`.
   - `npm run build` → `next build` (sin cambios).
   - Implementa el encadenado en `scripts/gates.mjs` (Node) para que los
     mensajes de error digan qué parte falló y con qué comando reproducirla;
     usa el Python de `.venv/Scripts/python` si existe, si no `python`.
     Los scripts previos (`dev`, `mcp`, etc.) no cambian de significado.
   - `requirements-dev.txt` (raíz): psycopg[binary], Faker, pytest, ruff,
     httpx, beautifulsoup4, lxml, pypdf, numpy, pgvector — es decir, lo que
     necesitan ruff/pytest de `db/` y `ml/` SIN torch ni FlagEmbedding (los
     tests de ml no cargan bge-m3; la indexación real usa `ml/requirements.txt`).
     Nota: los pyproject de db (py310) y ml (py311) difieren; los gates deben
     pasar con el Python del venv raíz (3.10) — si `ruff check ml` exige otro
     target, usa el flag `--target-version` en el comando del gate, sin tocar
     `ml/pyproject.toml`.
2. **`.env.example`** documentando (sin valores reales ni secretos):
   `DATABASE_URL` (con el default local como ejemplo), `PGPORT`, y como
   «llegan en S3» comentados: `XAI_API_KEY`, `PHOENIX_*`. Con comentarios en
   español explicando cada una.
3. **`README.md`** completo en español: qué es Relevo (3–4 frases + equipo +
   curso), arquitectura en 1 párrafo con link a `docs/ARQUITECTURA.md` y al
   entregable `docs/entrega/S2_arquitectura.html`, **cómo correrlo de cero**
   (requisitos: Node 24, Python 3.10+, Docker; pasos numerados: clonar,
   `docker compose up -d db`, venv + `pip install -r requirements-dev.txt`,
   `python db/migrate.py`, `python data/generar_dataset.py`,
   `python db/seed.py`, `npm ci`, `npm run dev`, `npm run mcp`, indexación del
   corpus con `ml/requirements.txt` + `python ml/indexar.py`), los tres gates,
   estructura del repo (tabla corta), estado por semana (S2 hecho, S3–S5 según
   plan) y las reglas duras (datos sintéticos, aprobación humana, secretos).
4. **Corrida end-to-end de la indexación** (para el reporte, con la BD del
   compose): venv aparte con `ml/requirements.txt` (el modelo bge-m3 ya está
   en el caché HF del usuario), luego
   `python ml/indexar.py --desde-cache` (SIN `--limit`: grabaría hashes con
   chunks parciales) contra la BD. Pega en el reporte: total de documentos y
   chunks insertados, y el resultado de las **10 consultas de verificación**
   vía SQL de `buscar_norma` (mismo SQL que `mcp/consultas.ts`) documentando
   consulta → primer resultado (ref + fuente): «recargo nocturno», «trabajo
   dominical», «horas extras», «jornada máxima legal», «descanso obligatorio»,
   «vacaciones anuales», «trabajo nocturno porcentaje», «licencia de
   maternidad» (si no hay resultado, dilo), «contrato de trabajo elementos»,
   «reducción de jornada laboral». Si `corpus/raw/` no existe en tu worktree,
   corre antes `python ml/indexar.py --solo-descarga`.
5. **Verificación final de novato**: sigue tu propio README de cero en el
   worktree (borrando `.venv` y `node_modules` primero) y corrige lo que no
   cuadre. El reporte debe decir explícitamente que lo hiciste.
6. **Calidad**: español, UTF-8 sin BOM, sin secretos.

## Gates (en ESTE worktree, uno a la vez)

```
npm run lint
npm test
npm run build
```

(los tres ya unificados, con la BD del compose activa)

## Entrega

- Reporte `docs/orca/reports/B2_INTEGRACION_REPORT.md`: decisiones, salida
  LITERAL de los tres gates unificados, conteos de la indexación, tabla de las
  10 consultas, y hash (`git rev-parse HEAD` como fuente de verdad).
- Commit único: `feat(integracion): gates unificados, README y corpus indexado (B2)`
- Sin push, sin merge, sin PR. No apagues la BD al terminar (la audita el
  orquestador).
