# Cloud deployment — Vercel + Neon + Modal

## Objective
Deploy Relevo so the live demo (presentation on 2026-10-13) runs from the
cloud with the same capabilities as local: chat + MCP + A2A auditor on Vercel,
PostgreSQL + pgvector on Neon, and the model services (bge-m3 embeddings /
re-rank and the fine-tuned extractor) on Modal. Add a deployment-architecture
slide that David presents, and its section in the presentation script.

## Why
The course PDF lists Vercel, Hugging Face Spaces and Modal as deployment
options, and the approved proposal promised deployment. Local demo is limited
by the laptop's RAM (~2.5 GB free of 15.7 GB). Lexical-only retrieval (what a
web-only deploy would have) scores recall@5 12.5 % / fidelity 0.188 vs hybrid
100 % / 0.926, so the model services must be deployed too.

## Decisions
- Free tiers: Vercel Hobby (functions up to 300 s, 2 GB), Neon Free (0.5 GB,
  pgvector + HNSW, scale-to-zero after 5 min), Modal Starter (~US$30/month
  credits, per-second billing).
- Auditor A2A served as route handlers of the same Next.js app
  (`/.well-known/agent.json`, `/a2a`); the assistant still calls it over HTTP
  through `AUDITOR_URL`, so A2A travels over the internet.
- Access code gate (env `ACCESS_CODE`) in front of the whole app: a public URL
  must not let anyone spend the xAI key.
- Deploy with the Vercel CLI from the local checkout; no GitHub push needed.
- Hard cut-off: if the four demo interactions do not pass on the cloud URL by
  2026-10-12 20:00, present locally and the slide says what is deployed.
- Secrets never in the repo, logs or chat: XAI_API_KEY, Neon URL, Modal tokens
  and ACCESS_CODE live in `.env` / provider dashboards only.

## Tasks
- [x] T1 Web/Vercel (delegated writer): auditor route handlers, serverless DB
  client (Neon pooler: `prepare:false`, small pool), access-code middleware,
  Vercel config, env contract. Route: delegated direct (2+ files).
- [x] T2 Modal (delegated writer): Modal app serving `/embed`, `/rerank`,
  `/salud` (bge-m3) and `/extraer` (Qwen3.5-0.8B + LoRA v2 adapter from a
  Modal Volume), same contracts as `ml/servir.py` and `ml/servir_extractor.py`.
  Route: delegated direct.
- [x] T3 Data to Neon (orchestrator): schema + roles + seed + corpus with
  precomputed embeddings copied from the local DB.
- [x] T4 Deploy + smoke (orchestrator): Modal deploy, Vercel deploy, env vars,
  the four demo interactions on the cloud URL.
- [x] T5 Slide «Arquitectura de despliegue» (HTML deck + editable deck) and
  script section for David.

## Acceptance criteria
- The four demo interactions pass on the cloud URL behind the access code,
  with retrieval in hybrid mode and the auditor verdict on the card.
- No secret in git history, slides or logs.
- Local mode still works unchanged (all env vars default to local).

## Progress
- 2026-10-12: branch `feat/despliegue` from `b12446d`; document created.
- T2 merged (fc7545c + fix 38899f3: `parents[2]` IndexError when app.py is imported at /root/app.py in the container). 11 local tests pass; image build untested until the user's Modal login. GPU L4; embeddings warm at ~US$3.8/day.
- T5 merged (78f4d62 + 0c92775): slide 14 «Tres nubes gratuitas, la misma arquitectura» (David), deck now 16 slides; editable deck artifact republished (version 9).

- T1 merged (9a1bd40) + Modal bearer header (cd66e63); gates: lint exit 0, vitest 125 passed, build exit 0.
- T3 done on Neon (Postgres 18.6, us-east-2): role `relevo` pre-created NOLOGIN so 0005 applies unchanged; owner granted `relevo_lector`/`relevo_escritor` WITH SET TRUE (PG16+ CREATEROLE does not self-grant SET); data copied with pg_dump --data-only (13 tables, counts identical, 589 embeddings, HNSW+GIN); login role `relevo_auditor` (member of relevo_lector) verified read-only; demo reset applied (120/0/0).

- T4 deployed: Vercel https://relevo-silk.vercel.app (region cle1, next to Neon us-east-2); Modal https://david-botero10--relevo-embeddings.modal.run (CPU, 1 warm container). Fixes during deploy: `.vercelignore` patterns anchored to root (`db/` was excluding `lib/db`); Git Bash path conversion broke `modal volume put` remote path (MSYS_NO_PATHCONV=1); Modal requires a payment method for GPU → `RELEVO_CON_EXTRACTOR=0` (web falls back to Grok); CPU re-ranker took ~26 s for 20 chunks and queued embeddings → re-ranker off by default (`/rerank` 501, RRF = evaluated configuration).
- Smoke on the cloud URL (2026-10-12 ~13:30): Q1 hybrid art. 168 + 160 in 38.7 s; Q2 3 people scoped to team in 12.1 s; Q3 card with A2A auditor «observaciones» art. 179 in 16.2 s; Q4 approval wrote origen=tarjeta row + pair in 0.3 s. Demo data reset (120/0/0).
- Pending: GPU extractor on Modal needs the user's decision on registering a card; slide/script must reflect what is deployed.

- UI redesign merged (dab0424, 0c580ac, fix 7th commit; merge d5478f2): sidebar with grouped history/search/delete, welcome with the 4 demo suggestions, tool-activity lane, markdown answers with citation chips, card states. Deps: lucide-react 1.48.0, react-markdown 10.1.0, remark-gfm 4.0.1. No migration. Gates: vitest 141 passed, build exit 0. Deployed to production; cloud re-check: Q1 hybrid 19.6 s, Q2 8.7 s, Q3 17.8 s (auditor «observaciones»), Q4 approval wrote origen=tarjeta row; history API: list own only, other user 404 on delete, delete own 200. Garbled test conversations (U+FFFD) deleted locally and on Neon (4 each). Demo data reset (120/0/0).
- Incident: main checkout `.venv` found empty (mtime 13:40, cause not identified) → recreated from requirements-dev.txt; `npm ci` blocked by the local auditor's esbuild.exe → auditor stopped, reinstalled, restarted on :8641. Local `next dev` (plan B) is down: start it with `npm run dev` before rehearsing.

## Next step
Launch T1 and T2 in parallel worktrees; user creates Vercel, Neon and Modal
accounts.
