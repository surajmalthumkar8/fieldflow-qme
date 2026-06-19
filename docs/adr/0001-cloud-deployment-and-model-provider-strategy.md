# ADR-0001: Cloud deployment + AI model-provider strategy

- **Status:** Proposed
- **Date:** 2026-06-19
- **Decision owner:** Shiva Dey
- **Supersedes / Superseded by:** —

## Problem
Techaegis AI is a local-first AI receptionist (Next.js frontend, FastAPI backend, Ollama
local models, Postgres+pgvector). We need to deploy it to the cloud for production. The
open questions: which platform, whether to keep self-hosted Ollama or move to an API, and
what it costs — including how the bill behaves as traffic scales up and down.

## Context
Current architecture (verified from the repo, 2026-06-19):
- **Frontend** — Next.js 15 / React, `frontend/` ([Dockerfile](../../frontend/Dockerfile)).
- **Backend** — FastAPI in Docker, `backend/` ([Dockerfile](../../backend/Dockerfile)),
  async SQLAlchemy + asyncpg, JWT auth, a background notification loop in the app
  lifespan, usage metering (`usage_event`/`usage_period`).
- **Models** — local **Ollama** `qwen2.5:1.5b` (fast tier) + a configurable reasoning
  tier; embeddings via Ollama; voice via local Kokoro. Routing is already env-driven in
  [config.py](../../backend/app/core/config.py) (`fast_model`, `reasoning_model`,
  `reasoning_host`, `ollama_host`).
- **Data** — Postgres + pgvector (`pgvector/pgvector:pg16` in
  [docker-compose.yml](../../docker-compose.yml)).
- **Multi-agent orchestration** — Python application logic; CPU-bound. Only the *model
  calls* need inference hardware.

Constraints: small team / cost-sensitive; receptionist must answer with low latency (no
60s cold starts); traffic is bursty B2B (idle nights/weekends).

**Key verified fact:** the LLM layer is already provider-swappable by design
(`langchain-ollama` today, "OpenAI/Anthropic later" per `requirements.txt`). The only hard
blocker to any non-GPU host is that **Ollama needs a GPU**, and **Render/Railway/Vercel
have no GPU** (Render's own docs say host the app there and offload GPU to RunPod/Modal or
an API).

## Alternatives considered

1. **Render + hosted API (Claude chat + OpenAI embeddings)** — host frontend + FastAPI +
   Postgres on Render; swap Ollama → API.
   - Pros: cheapest realistic fixed cost; inference **scales to zero** when idle; no GPU
     ops; removes the single-slot Ollama concurrency ceiling; provider already swappable.
   - Cons: per-token fees at high volume; gives up "free/private local inference".

2. **Render + external GPU (RunPod/Modal) running Ollama** — keep local models.
   - Pros: keeps private/local inference; predictable per-hour GPU cost.
   - Cons: always-on GPU **does not scale to zero** (~$300–600/mo even idle); serverless
     GPU scales to zero but adds 10–60s cold starts (unacceptable for a live receptionist);
     second vendor + ops.

3. **Railway all-in-one + hosted API** — same as (1) on Railway.
   - Pros: nicer monorepo DX; usage-based, often cheaper at low traffic.
   - Cons: usage billing less predictable; still no GPU (same API requirement).

4. **Hybrid (chosen): Render + hosted API in prod, Ollama stays for local dev.** Make the
   provider an env switch (`ollama | anthropic | openai`); cloud uses the API, laptops keep
   free local Ollama.
   - Pros: best of both — zero GPU bill in prod, free iteration locally, one code path.
   - Cons: two inference backends to keep behaviorally consistent (mitigated by LangChain
     abstraction already in place).

## Decision
Adopt the **hybrid**: deploy **frontend + FastAPI + Postgres on Render**, and make the
model provider an **environment switch** — **Anthropic Claude for chat, OpenAI for
embeddings** in production, **Ollama retained for local development**. No GPU in the cloud.

Concretely:
1. Add `LLM_PROVIDER` / `EMBED_PROVIDER` env vars; extend `_make_chat_model` + `_embedder`
   in [llm.py](../../backend/app/services/llm.py) to return `ChatAnthropic` / OpenAI
   embeddings when set (Ollama remains the default for dev).
2. Resize the pgvector column to the new embedding dimension (Ollama dim → OpenAI 1536) and
   add a one-off re-embed script.
3. Add `render.yaml` defining three services (web: frontend, web: backend, Postgres).
4. Provide voice fallback (disable Kokoro in cloud or point `/voice` at a hosted TTS).

Rationale / deciding trade-off: the receptionist is **bursty and latency-sensitive**. Only
the API path gives **both** scale-to-zero idle cost **and** no cold start. The GPU path
forces a choice between paying ~$300–600/mo while idle, or eating cold starts that break
the product. Embeddings go to OpenAI because **Anthropic has no embeddings API**.

## Cost implications
Fixed infra on Render (verified pricing 2026-06-19):

| | Monthly | Annual |
|---|--------:|-------:|
| Frontend (Starter, always-on) | $7 | $84 |
| Backend (Starter→Standard) | $7–25 | $84–300 |
| Postgres (Basic→prod) | $7–20 | $84–240 |
| **Fixed total** | **$21–52** | **$252–624** |
| Variable: Claude/OpenAI tokens* | ~$20–500 (load-dependent) | scales with traffic |
| Embeddings (OpenAI) | negligible (cents) | negligible |

\* Token estimate, fast/Haiku-class model, ~6–10 turns/conversation: **~$0.02–0.05 per
conversation**. ≈ $20–50/mo at 1k convos, $200–500/mo at 10k. (Refine with the exact
per-prompt calculation before committing to a model tier.)

- **Operational cost:** Low — three managed Render services, no GPU to babysit.
- **Engineering cost:** Low — ~30-line provider swap (abstraction already exists) +
  pgvector re-embed + `render.yaml`. Days, not weeks.
- **Scaling cost:** **Down** → idle cost falls to the ~$21–52 fixed (inference → $0). **Up**
  → token cost grows linearly; Render Standard+ autoscales the web tier; no Ollama
  single-slot ceiling. Contrast the GPU path: idle still burns $300–600/mo and scaling up
  means adding whole GPUs (step-function cost).
- **Hidden costs:** Render egress beyond plan; OpenAI embedding re-runs on KB re-ingest;
  vendor lock-in to Render config (low — it's just Docker); Render workspace per-seat fee
  ($19/user) only if team features are needed.

## Risk analysis
| Risk | Likelihood | Blast radius | Mitigation |
|------|-----------|--------------|------------|
| Token bill spikes with traffic | Medium | Cost | Metering already in place; alert + cap; use cheapest viable model tier |
| API outage (Anthropic/OpenAI) | Low | Availability | Provider switch lets us fail over to a second API or local Ollama |
| Embedding-dim migration breaks RAG | Medium | KB search | One-off re-embed script + verify on staging before cutover |
| Loss of data privacy (data leaves to API) | — | Compliance | If unacceptable, fall back to alt. 2 (GPU) — keep the switch |
| Render free-tier surprises (spin-down/expiry) | Low | UX/data | Use paid Starter tier in prod, not free |

## Migration difficulty
**Low–Medium.** The provider abstraction already exists; the only real work is the
embedding-dimension change + re-embed and the `render.yaml`. No application rewrite.

## Future implications
- Enables future provider arbitrage (Claude ↔ Gemini ↔ Groq ↔ OpenAI) via the same switch
  — revisit when a cheaper/faster model ships.
- Keeps the door open to alt. 2 (self-host GPU) if privacy or extreme-scale token cost
  later dominates; the switch makes that reversible.
- Revisit this ADR if: monthly token spend exceeds the cost of a dedicated GPU (~break-even
  around heavy, steady 24/7 load), or a data-residency requirement forbids external APIs.

## Sources
- [Render Pricing](https://render.com/pricing) · [Render: GPU offload guidance](https://render.com/articles/serverless-vs-unified-genai-backends)
- [Railway Pricing](https://railway.com/pricing) · [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [Supabase Pricing](https://uibakery.io/blog/supabase-pricing) · [Anthropic models/pricing](https://docs.anthropic.com/en/docs/about-claude/models)
- [OpenAI API pricing](https://openai.com/api/pricing/)
- Repo (verified 2026-06-19): `docker-compose.yml`, `backend/app/core/config.py`, `backend/requirements.txt`
