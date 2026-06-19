# CLAUDE.md — start here

Onboarding context for an AI session picking up this project fresh. Read this first, then
the linked docs as needed.

## What this is
**Techaegis AI** — a local-first **AI receptionist SaaS for real-estate companies**. A
company's customers chat/talk with an AI ("Elara") that answers from the company's
knowledge, qualifies the lead, and books a meeting with a human agent. Around it: agent,
company-admin, and platform (super-admin) dashboards. Lineage: evolved from the "FieldFlow /
QME" home-services demo (reactivation SMS + TCPA/DNC compliance), which still coexists.

## Read these for depth
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — motive, frontend, backend, **data
  architecture**, key flows, deployment. (The main doc.)
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** — what changed recently and why.
- **[docs/adr/](docs/adr/)** — architecture decisions (cloud, model provider, topology).
- **[docs/governance/hybrid-migration-plan.md](docs/governance/hybrid-migration-plan.md)** —
  the planned cloud move (Vercel + Render + Supabase + external model API + HF embeddings).
- **[README.md](README.md)** — product intro + quickstart.

## Stack (one-liner)
Next.js 15 (App Router, TS) frontend · FastAPI (async SQLAlchemy) backend · PostgreSQL +
**pgvector** · LangChain → **Ollama** (provider-swappable to Claude/OpenAI) · Kokoro TTS ·
Twilio SMS (optional) · JWT auth · Docker Compose.

## Data model (critical to know)
**One DB `fieldflow`, two schemas:**
- `public` — **Prisma** (frontend): `Business`, `Lead`, `Conversation`, `Message`,
  `Booking`, `ComplianceEvent` (demo/FieldFlow + tenant records).
- `techaegis` — **FastAPI** (the live app): `app_user`, `app_session`, `chat_conversation`/
  `chat_message`, `kb_document`/`kb_chunk` (pgvector), `appointment`, `agent_thread`/
  `agent_message`, `feedback`, `usage_event`/`usage_period`, `campaign`/`campaign_interest`.

`business_id` is a plain string linking the two (no cross-schema FK).

## Conventions that matter
- **Tenant scope comes from the JWT, never the request body.** Every backend data endpoint
  derives `business_id`/`user_id` from `current_user`. Next.js `app/api/*` routes are thin
  proxies that forward `Authorization: Bearer <ff_token>` (cookie).
- **Roles:** `super_admin` (platform, no business) → `admin` (one company) → `agent` →
  `customer`. Nav (`frontend/lib/nav.ts`) + `frontend/middleware.ts` gate by role.
- **LLM is provider-swappable** via `backend/app/core/config.py` + `services/llm.py`
  (Ollama default; Claude/OpenAI by env). Prompts are **editable YAML** in
  `backend/app/prompts/` (re-read per request).
- **`next build` runs without `DATABASE_URL`** — keep DB access lazy/dynamic (Prisma client
  is lazy; `(app)` layout is `force-dynamic`). Don't query the DB at module import time.

## Run it (local, Docker)
```bash
docker compose up -d --build      # Postgres+pgvector, FastAPI :8000, Next.js :3000
docker compose ps                 # backend+frontend healthy; migrate exited(0) = OK
```
Open http://localhost:3000. The Docker stack uses its **own** seeded DB (volume `pgdata`),
separate from any local Postgres. Customers self-register; promote a user with SQL:
```bash
docker exec fieldflow-qme-db-1 psql -U fieldflow -d fieldflow -c \
  "UPDATE techaegis.app_user SET role='super_admin', business_id=NULL WHERE email='you@example.com';"
```

## Local-only secrets
`.env` (gitignored) holds DB/SMTP/Twilio creds. `.env.example` documents the keys. Ollama +
Kokoro run on the host; the backend reaches them via `host.docker.internal`.

## In-flight / next
- Wire Twilio `sms.send_sms` into campaign/reactivation sending (consent gate + STOP webhook).
- Execute the hybrid cloud migration (write ADR-0003 when starting it).
- A reusable **Architecture Governance** agent + skills live in `.claude/` — use them for
  any cloud/cost/architecture decision (they research current docs + write ADRs).
