# Techaegis AI — Project Architecture

A reference for what this project is, why it exists, and how the frontend, backend, and
data layers fit together. Pair with the [CHANGELOG](CHANGELOG.md) (what changed) and the
[ADRs](adr/) (why key decisions were made).

---

## 1. Motive — what & why

**Techaegis AI is a local-first AI receptionist SaaS for real-estate companies.** A
company's customers chat (or talk) with an AI receptionist ("Elara") that answers
questions from the company's own knowledge, qualifies the lead (intent, budget, timeline,
financing), books a meeting with a human agent, and hands off hot leads. Around that core
sit dashboards for agents, company admins, and the platform owner.

Design goals:
- **Local-first / low-cost inference** — runs on a local **Ollama** model (`qwen2.5:1.5b`)
  with **pgvector** RAG and **Kokoro** voice, so a demo costs ~$0 to run. The LLM layer is
  **provider-swappable** (Ollama today; Claude/OpenAI via env later — see [ADR-0001](adr/0001-cloud-deployment-and-model-provider-strategy.md)).
- **Multi-tenant** — many companies, isolated by `business_id`, scoped from the auth token.
- **Compliance-aware** — the repo also carries the original **FieldFlow** home-services demo
  (reactivation SMS, TCPA/DNC/A2P 10DLC consent gates, attribution) that the real-estate
  product is evolving from.

> Lineage: this began as the "QME engine" / FieldFlow (HVAC/roofing reactivation + compliance)
> and pivoted to the Techaegis real-estate receptionist. Both code paths still coexist.

---

## 2. Tech stack (high level)

```
┌──────────────── Browser ────────────────┐
│  Next.js 15 (App Router, React, TS)      │
│  - role-based UI (super_admin/admin/      │
│    agent/customer)                        │
│  - /api/* proxies forward the auth cookie │
└───────────────┬───────────────┬──────────┘
                │ Prisma         │ HTTP (Authorization: Bearer ff_token)
                │ (demo data)    ▼
                │        ┌──────────────────────────────┐
                │        │  FastAPI (Python, async)       │
                │        │  - JWT auth, per-tenant scope  │
                │        │  - LangChain → Ollama (LLM)    │
                │        │  - pgvector RAG, metering,     │
                │        │    scheduling, campaigns, SMS  │
                │        └───────────┬────────────────────┘
                ▼                    ▼
        ┌─────────────────────────────────────────────┐
        │  PostgreSQL (one DB: `fieldflow`)             │
        │   • public      → Prisma (demo/FieldFlow)     │
        │   • techaegis   → FastAPI (app + pgvector)    │
        └─────────────────────────────────────────────┘
                ▲
        Ollama (LLM + embeddings) · Kokoro (TTS) — local, on the host
```

- **Frontend:** Next.js 15 App Router + React + TypeScript + Tailwind, recharts for charts.
- **Backend:** FastAPI + async SQLAlchemy (asyncpg) + LangChain (`langchain-ollama`).
- **DB:** PostgreSQL + **pgvector**. **Auth:** JWT (`ff_token` httpOnly cookie + `ff_role`).
- **AI:** Ollama (chat + embeddings), Kokoro/`say` (voice). **SMS:** Twilio (optional).
- **Email:** SMTP (calendar invites, notifications). **Deploy:** Docker Compose (local).

---

## 3. Frontend architecture (`frontend/`)

Next.js App Router. Two roles for the frontend: render the role-scoped UI, and **proxy**
authenticated calls to the FastAPI backend (forwarding the `ff_token` cookie as a Bearer).

- **`app/(app)/`** — the authenticated app shell. [`layout.tsx`](../frontend/app/(app)/layout.tsx)
  loads the tenant list + current user and renders Sidebar + Topbar. It is
  `force-dynamic` (per-request, reads the session cookie).
  - Customer: `profile`, `receptionist`, `my-agent`, `my-feedback`
  - Agent: `leads`, `conversations`, `scorecard`, `dashboard`
  - Admin: `admin/overview`, `admin/customers`, `admin/campaigns`, `admin/performance`,
    `admin/feedback`, `admin/cost`, `admin/billing`, `admin/agents`, `admin/knowledge`
  - Super admin: `admin/insights`, `admin/revenue`, `admin/companies`, `admin/admins`
  - FieldFlow demo: `reactivation`, `compliance`, `audit`, `config`
- **`app/api/*`** — thin proxies to FastAPI. Each reads `ff_token` from cookies and forwards
  `Authorization: Bearer …` (e.g. [api/campaigns](../frontend/app/api/campaigns/)). The
  backend — not the browser — is the source of truth for tenant scope.
- **`lib/nav.ts`** — single source of truth for navigation; filtered by role + grouped
  (You / Overview / Workspace / Insights / Billing / Setup / Manage).
- **`middleware.ts`** — gates routes by role (redirects unauth → `/login`, wrong-role →
  that role's home). Data is still JWT-gated server-side; this is UI routing + privacy.
- **`lib/db.ts`** — a **lazy** Prisma client (constructed on first query) for the demo data
  in the `public` schema. **`lib/aiService.ts`** — client for the FastAPI AI endpoints.
- **`components/`** — `receptionist/` (chat/voice UI, ActiveOffers, booking), `messaging/`
  (agent↔customer chat), `layout/` (Sidebar, Topbar, NotificationBell), `ui/` (primitives).

---

## 4. Backend architecture (`backend/app/`)

FastAPI microservice. Owns its tables in the **`techaegis`** schema. Auth via JWT; every
data endpoint scopes `business_id`/`user_id` from the token (never the request body).

- **Routers** (`routers/`): `auth`, `chat` (receptionist turn, RAG-grounded), `qualify`/
  `summarize` (lead scoring/summary), `conversations`, `agent` (leads, scorecard, insights),
  `admin` (overview, performance, companies, invites), `feedback`, `messaging`
  (agent↔customer threads), `billing`, `campaigns`, `kb` (knowledge base), `leads`,
  `scheduling` (availability + booking + calendar links), `sms`, `voice`, `health`.
- **Services** (`services/`):
  - `llm` — LangChain chat models + embeddings, role→model/host tiers, token capture.
    Provider-swappable (Ollama → Claude/OpenAI by env).
  - `rag` — chunk + embed (pgvector) + cosine retrieval for the receptionist's answers.
  - `metering` + `pricing` — usage events + editable `pricing.yaml` rates → billing.
  - `scheduling` — slot generation, conflict-safe booking, ICS + Google Calendar links.
  - `notifications` + `email` — background stale-message + campaign emails over SMTP.
  - `messaging` — agent↔customer threads, read receipts, question templates.
  - `campaigns` — "what offers are live now" (shared by the API + the AI prompt).
  - `sms` — Twilio send (optional; disabled until creds).
- **Prompts** (`prompts/*.yaml`) — the receptionist persona + qualify/summarize prompts are
  **editable YAML**, re-read per request (no redeploy). Campaign offers are injected here.
- **Core** (`core/`): `config` (env settings + model tiers), `database` (async engine,
  schema bootstrap, pgvector + table creation on startup), `security` (JWT + bcrypt),
  `deps` (the `current_user` dependency).

---

## 5. Data architecture

**One PostgreSQL database (`fieldflow`) split into two schemas** so Prisma and FastAPI
coexist without stepping on each other:

### `public` — Prisma (the FieldFlow demo + tenant records)
| Model | Purpose |
|-------|---------|
| `Business` | Tenant: name, `trade` (real_estate / hvac / …), `markets` (US,IN), hours, services, FAQs, pricing, A2P/consent posture. Customers register under `trade=real_estate` ones. |
| `Lead` | Consented contact list: consent status, DNC/reassigned scrub, `smsEligible`. |
| `Conversation` / `Message` | Demo AI call/SMS transcripts + outcomes. |
| `Booking` | Booked/held appointments + revenue (attribution math). |
| `ComplianceEvent` | TCPA/DNC/A2P audit trail. |

### `techaegis` — FastAPI (the live app)
| Table | Purpose |
|-------|---------|
| `app_user`, `app_session`, `password_reset` | Auth: users (super_admin/admin/agent/customer), JWT sessions, invite/reset tokens. |
| `chat_conversation`, `chat_message` | Real persisted receptionist conversations + lead scoring/assignment. |
| `kb_document`, `kb_chunk` | Knowledge base; `kb_chunk.embedding` is a **pgvector** column (RAG). |
| `appointment` | Scheduled agent meetings. |
| `agent_thread`, `agent_message`, `question_template` | Human agent ↔ customer messaging. |
| `feedback` | Customer ratings of AI vs agent (+ summarizer themes). |
| `usage_event`, `usage_period` | Metering for billing. |
| `campaign`, `campaign_interest` | Marketing offers + customer interest (this session). |

**Linkage:** the backend stores `business_id` as a plain string (no cross-schema FK) — it
matches `public.Business.id`. Scope always flows from the **JWT**, not the request body.

### Auth model & roles
JWT in an httpOnly `ff_token` cookie + a readable `ff_role` cookie for middleware routing.
Roles: **`super_admin`** (platform; no `business_id`) → **`admin`** (one company) →
**`agent`** (handles that company's leads) → **`customer`** (a company's end user). See
[ADR / role notes].

---

## 6. Key flows

- **Receptionist turn:** browser → `/api/ai/chat` (proxy adds Bearer) → FastAPI `/chat` →
  RAG context from pgvector + live campaign offers injected into the persona prompt →
  Ollama → structured JSON (reply, qualified, sentiment, action, captured) → persisted to
  `chat_conversation`; usage metered.
- **Lead → agent:** conversations are auto-scored (grade/budget/intent) when an agent opens
  their leads view; agents self-assign and message the customer; admins see performance.
- **Booking:** receptionist offers real open slots → `/scheduling/book` → `appointment` +
  ICS/Google Calendar invite emailed.
- **Campaign:** admin creates/launches an offer → AI advertises it to matching customers →
  customer taps "I'm interested" → staff notified → agent follows up.

---

## 7. Deployment

- **Local (today):** `docker compose up -d --build` → Postgres+pgvector, FastAPI (:8000),
  Next.js (:3000); a one-shot `migrate` seeds demo data. Ollama/Kokoro run on the host.
- **Cloud (planned):** see [ADR-0001](adr/0001-cloud-deployment-and-model-provider-strategy.md),
  [ADR-0002](adr/0002-frontend-hosting-and-topology.md), and the
  [hybrid migration plan](governance/hybrid-migration-plan.md) — frontend on Vercel,
  FastAPI on Render, Postgres+pgvector on Supabase, LLM via an external API (no GPU),
  embeddings via Hugging Face.
