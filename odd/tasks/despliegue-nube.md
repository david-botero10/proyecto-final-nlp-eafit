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
- [ ] T1 Web/Vercel (delegated writer): auditor route handlers, serverless DB
  client (Neon pooler: `prepare:false`, small pool), access-code middleware,
  Vercel config, env contract. Route: delegated direct (2+ files).
- [ ] T2 Modal (delegated writer): Modal app serving `/embed`, `/rerank`,
  `/salud` (bge-m3) and `/extraer` (Qwen3.5-0.8B + LoRA v2 adapter from a
  Modal Volume), same contracts as `ml/servir.py` and `ml/servir_extractor.py`.
  Route: delegated direct.
- [ ] T3 Data to Neon (orchestrator): schema + roles + seed + corpus with
  precomputed embeddings copied from the local DB.
- [ ] T4 Deploy + smoke (orchestrator): Modal deploy, Vercel deploy, env vars,
  the four demo interactions on the cloud URL.
- [ ] T5 Slide «Arquitectura de despliegue» (HTML deck + editable deck) and
  script section for David.

## Acceptance criteria
- The four demo interactions pass on the cloud URL behind the access code,
  with retrieval in hybrid mode and the auditor verdict on the card.
- No secret in git history, slides or logs.
- Local mode still works unchanged (all env vars default to local).

## Progress
- 2026-10-12: branch `feat/despliegue` from `b12446d`; document created.

## Next step
Launch T1 and T2 in parallel worktrees; user creates Vercel, Neon and Modal
accounts.
