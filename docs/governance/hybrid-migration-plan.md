# Plan: Hybrid Cloud Migration — Vercel + Render + Supabase + External Model APIs

> **Status:** Approved plan (documentation hand-off, 2026-06-19). **No code changes yet** —
> execution + report-splitting to be instructed in a follow-up session.
> Source of truth for the next session. Pairs with the ADR store in [`../adr/`](../adr/).

## Context

We are taking Techaegis AI (the local-first AI receptionist) to the cloud. After the
governance review ([ADR-0001](../adr/0001-cloud-deployment-and-model-provider-strategy.md),
[ADR-0002](../adr/0002-frontend-hosting-and-topology.md)) the team has **chosen a 3-vendor
hybrid** (deliberately, over the all-on-Render option):

- **Frontend (Next.js/React)** → **Vercel**
- **Backend (FastAPI, Docker)** → **Render**
- **Database (Postgres + pgvector)** → **Supabase**
- **LLM inference** → **external model APIs** (no local Ollama, no GPU)
- **Embeddings** → a **Hugging Face** embedding model (approach TBD — see open decisions)

Goals: ship to production cheaply, drop the GPU requirement, keep the full built UI, and
keep the model/embedding providers swappable. This document is the agreed direction so the
next session can execute and split the cost report into a frontend track and a backend
track.

> This supersedes the *topology* choice in ADR-0002 (which recommended all-on-Render).
> **First execution step next session: write ADR-0003 recording this hybrid decision** (and
> note the cost delta below) so the governance log stays consistent.

---

## Target architecture

```
  Browser
     │  HTTPS
     ▼
  Vercel  ── Next.js (native build; NOT Docker) ── /api/* proxies ──┐
     │                                                              │ HTTPS (CORS)
     ▼                                                              ▼
  (static + SSR + serverless fns)                          Render ── FastAPI (Docker)
                                                              │            │
                                          external model APIs │            │ asyncpg
                                          (chat) + HF (embed) ◀┘            ▼
                                                                    Supabase Postgres
                                                                    + pgvector (vector store)
```

Key data flow unchanged: the Next.js `/api/**` proxies forward `Authorization: Bearer
<ff_token>` to the FastAPI backend (now at a Render URL via `AI_SERVICE_URL`); the backend
calls the model API for chat and the HF embedder for RAG; vectors live in Supabase pgvector.

---

## Compatibility findings (Docker on Vercel vs Render)

| Component | Vercel | Render |
|-----------|--------|--------|
| **Frontend (Next.js)** | Runs as a **native build → serverless functions**. Vercel **ignores your `frontend/Dockerfile`**. Works great, but it is *not* a Docker deploy. Commercial use **requires Vercel Pro ($20/mo)**. | Runs `frontend/Dockerfile` natively (Node server on :3000). |
| **Backend (FastAPI)** | Not a fit (long-running ASGI server + lifespan notification loop ≠ serverless). | Runs `backend/Dockerfile` natively (`uvicorn` on `$PORT`). ✅ |

**Conclusion baked into this plan:** Frontend → Vercel as a **native Next.js build (no
Docker)**; backend → Render as **Docker**. The `frontend/Dockerfile` stays only for local
dev / docker-compose. **If we later require Docker for the frontend too, the frontend must
move to Render** (Vercel will never run it as a container).
Source: [Vercel — does Vercel support Docker deployments](https://vercel.com/kb/guide/does-vercel-support-docker-deployments).

---

## Workstreams

### A. Database → Supabase (Postgres + pgvector)
- Create a Supabase project; in the SQL editor run `CREATE EXTENSION IF NOT EXISTS vector;`
  (Supabase supports pgvector + HNSW). Our startup already runs this in
  [`backend/app/core/database.py`](../../backend/app/core/database.py) (~line 70), idempotent.
- Point the backend `DATABASE_URL` at Supabase.
- **Gotcha:** Supabase's transaction pooler (pgbouncer, port 6543) breaks asyncpg prepared
  statements. Use the **session pooler / direct connection (5432)** OR set
  `statement_cache_size=0` on the asyncpg engine. Decide + document the connection string.
- **Gotcha:** Supabase **free tier pauses after ~7 days idle** — fine pre-launch, move to
  Pro ($25/mo) for production.
- Run the existing schema bootstrap (`Base.metadata.create_all`) against Supabase; verify
  the `techaegis.kb_chunk.embedding` `vector` column + HNSW index are created.

### B. LLM provider swap (Ollama → external API)
Localized branch point — the abstraction already exists (`requirements.txt` notes
"provider-swappable: Ollama today, OpenAI/Anthropic later").
- [`backend/app/core/config.py`](../../backend/app/core/config.py) — add `llm_provider`
  (`ollama|anthropic|openai|...`) + API-key fields to `Settings`; keep `model_for()` /
  `host_for()` signatures stable.
- [`backend/app/services/llm.py`](../../backend/app/services/llm.py) — branch
  `_make_chat_model()` (~41–65) to return `ChatAnthropic` / `ChatOpenAI` instead of
  `ChatOllama`; make `ollama_up()` (~176–183) conditional so health checks don't false-fail
  when Ollama isn't the provider; verify token-usage capture (~109–114) maps per provider
  (`usage_metadata`).
- [`backend/app/routers/health.py`](../../backend/app/routers/health.py) — skip the Ollama
  probe when provider ≠ ollama.
- [`backend/requirements.txt`](../../backend/requirements.txt) — add `langchain-anthropic` /
  `langchain-openai`; keep `langchain-ollama` for local dev (dual-mode).
- [`backend/app/config/pricing.yaml`](../../backend/app/config/pricing.yaml) — update token
  rates to the real provider cost so metering (`chat.py` ~149–153, `services/metering.py`)
  bills correctly.
- Keep Ollama as the **default for local dev**; cloud sets `LLM_PROVIDER` via env.

### C. Embeddings → Hugging Face
Decide between three HF approaches (see open decisions); each touches the same code:
- [`backend/app/services/llm.py`](../../backend/app/services/llm.py) `_embedder()` (~68–70)
  — branch to a HF embedder (`HuggingFaceEmbeddings` / `HuggingFaceEndpointEmbeddings`, or
  `sentence-transformers`).
- **Dimension alignment** — current `EMBEDDING_DIM=768` (`config.py` ~line 38) drives
  `Vector(EMBEDDING_DIM)` in [`backend/app/models/knowledge.py`](../../backend/app/models/knowledge.py) (~line 41).
  - Pick a **768-dim HF model (e.g. `all-mpnet-base-v2`) → NO DB migration.**
  - Pick a different dim (e.g. MiniLM 384) → requires `ALTER TABLE ... ALTER COLUMN embedding
    TYPE vector(N)` + **re-embed all KB chunks** + rebuild the HNSW index. Add a one-off
    migration/re-embed script.
- Embeddings + stored vectors **must share one dimension** — never query a 1536-dim vector
  against a 768-dim column (pgvector errors).

### D. Frontend → Vercel
- Deploy `frontend/` as a native Next.js project (no Docker). Requires **Vercel Pro**.
- Env: `AI_SERVICE_URL` = the Render backend URL; any client/runtime vars.
- **CORS:** backend `CORS_ORIGINS` must include the Vercel domain (prod + preview URLs).
  Confirm the `/api/**` proxy routes forward `Authorization` to the Render backend.
- Confirm the Prisma `db:push`/seed step (currently the docker-compose `migrate` one-shot) is
  handled out-of-band against Supabase, since Vercel won't run that job.

### E. Backend → Render
- Deploy `backend/Dockerfile` as a Render Docker web service; start
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Env: `DATABASE_URL` (Supabase), `LLM_PROVIDER` + API keys, `EMBED_PROVIDER` + HF token,
  `CORS_ORIGINS` (Vercel domain), `APP_URL`, `JWT_SECRET` (real secret), SMTP, `TTS_PROVIDER`.
- Health check `/health/ready` already exists; ensure it doesn't depend on Ollama.
- **Voice (Kokoro):** no GPU on Render — disable in cloud or point `/voice` at a hosted TTS
  (decision deferred; not blocking).

---

## Cost (this hybrid, verified 2026-06-19)

| Item | Pre-launch | Production |
|------|-----------:|-----------:|
| Vercel Pro (commercial, mandatory) | $20/mo | $20/mo |
| Render backend (Starter→Standard) | $7 | $7–25 |
| Supabase (Free→Pro) | $0 | $25 |
| External model API (chat) | tokens (cents/convo) | scales w/ traffic |
| HF embeddings | $0 (in-process CPU) or HF API tokens | small |
| **Total fixed** | **~$27/mo** | **~$52–70/mo** |

Transparency note (not an objection): this hybrid runs **~$27–70/mo** vs the all-on-Render
option at **~$14–21/mo** — the delta is mainly the mandatory Vercel Pro seat + Supabase Pro.
The team has chosen the hybrid knowingly; record the rationale in ADR-0003.

---

## Open decisions (resolve in the next session)

1. **Chat model provider + model:** Anthropic Claude (e.g. Haiku) vs OpenAI (e.g. 4o-mini)
   vs Gemini vs Groq. (Affects cost + latency; code stays provider-agnostic via env.)
2. **HF embedding approach:** (a) in-process `sentence-transformers` on CPU in the backend
   container (free, no extra service, pick **768-dim `all-mpnet-base-v2` → no migration**);
   (b) HF Serverless Inference API (pay-per-token, no CPU load); (c) HF dedicated endpoint
   (GPU $/hr — likely overkill). **Recommendation to confirm: (a) with a 768-dim model.**
3. **Embedding dimension:** keep 768 (no migration) vs switch (migration + re-embed script).
4. **Supabase connection mode:** session pooler/direct vs transaction pooler +
   `statement_cache_size=0`.
5. **Voice in cloud:** disable vs hosted TTS.
6. **Report split:** structure the cost/effort report into a **frontend track (Vercel)** and
   a **backend track (Render + Supabase + models)**.

---

## Verification (after execution, next session)

1. **DB:** connect to Supabase; `SELECT * FROM pg_extension WHERE extname='vector';` returns
   a row; schema + HNSW index created; a test insert/select on `kb_chunk.embedding` works.
2. **Backend on Render:** `/health/ready` → 200 with provider ≠ ollama; a `/chat` call
   returns a reply and meters tokens > 0; `/qualify`, `/summarize` work.
3. **RAG:** ingest a KB doc; embeddings stored at the chosen dimension; `search()` returns
   hits (no dimension-mismatch error).
4. **Frontend on Vercel:** pages load; gated routes redirect; `/api/**` proxy reaches the
   Render backend with `Authorization` forwarded; CORS clean.
5. **End-to-end:** customer signs in → chats with the receptionist → books → conversation
   persists and metering/billing increments for the right business.
6. **Cost sanity:** run the `cost-optimization` skill against the new infra to confirm no
   idle/duplicate services and that `pricing.yaml` rates match the chosen provider.

---

## Reusable assets already in the repo (use these next session)
- Governance agent: [`.claude/agents/architecture-governance.md`](../../.claude/agents/architecture-governance.md)
- Skills: `documentation-research`, `impact-analysis`, `cost-optimization`, `deployment-review` (under `.claude/skills/`)
- ADR store: [`docs/adr/`](../adr/) (write **ADR-0003** for this hybrid decision)
- Provider abstraction is pre-built in `backend/app/services/llm.py` + `config.py`
