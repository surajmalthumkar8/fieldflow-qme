# FieldFlow — the QME engine (working MVP)

**▶ Live demo: https://qme-app.vercel.app**  ·  Code: this repo.

A working demonstration of the **TechAegisAI "Qualified Meetings" (QME)** engine: a
**done-for-you AI service that books held, high-ticket home-services jobs** (HVAC
replacement, roofing) for owner-operated US contractors — and **proves every dollar
with a recorded attribution report.** Sold as recovered revenue, never as "an AI agent."

> Ships under the sub-brand **FieldFlow** ("Powered by TechAegisAI") — never the
> $40k-enterprise parent brand. Built and run from India (3-person team), sold to
> US contractors. The strategy was validated against the market (competitors:
> RevSquared, Avoca, Netic, Sameday, Podium, Hatch→Yelp $270M) before this MVP was built.

## What it demonstrates (the whole machine)

| Module | What you see | Why it matters |
|---|---|---|
| **Attribution dashboard** (`/dashboard`) | Funnel `call → qualified → booked → HELD → $ recovered`, ROI vs. monthly cost, held high-ticket jobs table | **This is the product.** Every pricing & positioning advantage depends on it. |
| **AI Receptionist** (`/receptionist`) | A live, in-browser AI front desk you can **talk to (voice) or type to** — it qualifies and **books a real job** that lands on the dashboard | The durable retainer. Maps 1:1 to a Vapi/Retell voice agent in production. |
| **Reactivation** (`/reactivation`) | AI-composed SMS to the consented dormant list → simulate replies → booked/held jobs | The pilot hook & proof generator (a one-time "sugar high"). |
| **Leads & Consent** (`/leads`) | CSV upload, per-lead consent audit, DNC + Reassigned-number scrubs, re-consent gate | Only consented, scrubbed leads are messageable. |
| **Compliance** (`/compliance`) | Consent gate, **co-sender TCPA exposure**, A2P-under-client-EIN checklist, hard-coded disclosures, 5-year audit log | The moat — done-for-you delivery + documented compliance. |
| **Business Config** (`/config`) | The single tenant config (services, hours, FAQ, escalation, pricing, A2P) | Feeds the voice prompt, FAQ/RAG, reactivation copy, A2P, and attribution at once. |

## Repo layout

```
frontend/   Next.js 15 app (UI + CRUD API routes)  — the dashboard you see
backend/    FastAPI AI/voice microservice (local Ollama, JWT auth, pgvector RAG, TTS)
docs/       product_roadmap.md · research_findings.md · codebase_reference.md
scripts/    dev.sh (run both services)
docker-compose.yml
```

## Run it — one Docker command

```bash
docker compose up
```

Brings up **Postgres + pgvector**, the **FastAPI AI service** (:8000), and the **Next.js app**
(:3000) with an automatic migrate + seed. By default the AI service reuses **Ollama on your
host** (so it doesn't re-download models); to run Ollama in a container too:
`docker compose --profile ollama up`. Open **http://localhost:3000**.

> Voice note: the macOS `say` fallback only works outside Docker; in-container voice needs the
> Kokoro model files (see `backend/README.md`).

## Run it — local dev (no Docker)

Requires Node 18+, Python 3.11+, a local **Postgres** (`createdb fieldflow`, `CREATE EXTENSION vector;`),
and **Ollama** running with the models pulled.

```bash
# frontend (Next.js)
cd frontend && npm install && npm run setup   # prisma generate + db push + seed
npm run dev                                    # http://localhost:3000

# backend (FastAPI) — in another terminal
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

Or run both at once: `./scripts/dev.sh`. The repo-root `.env` is shared by both services
(the frontend reads it via a `frontend/.env` symlink). To re-seed: `cd frontend && npm run db:reset`.

## Dual-mode AI / integrations (works with or without keys)

The app is fully functional with **no API keys** — it uses a deterministic **demo brain**
and **simulated** Twilio/Cal.com adapters. Add keys in `.env` (see `.env.example`) to switch
to the real production paths — no code changes:

- `ANTHROPIC_API_KEY` → the receptionist + SMS qualifier run on **live Claude Haiku** (the
  topbar badge flips from "Demo brain" to "Live Claude Haiku").
- `TWILIO_*` → real SMS sends via the Twilio REST API.
- `CALCOM_API_KEY` / `VAPI_API_KEY` → wire real booking / production inbound voice.

## Tech & architecture

- **Next.js 15** (App Router, RSC) · **TypeScript** · **Tailwind v3** · **Prisma + SQLite**
  (the schema maps 1:1 to **Supabase Postgres** — change the datasource provider + add
  row-level-security on `businessId` for production multi-tenant).
- **AI brain**: `lib/ai/brain.ts` — one contract, dual engines (live Claude / demo).
- **Compliance**: `lib/compliance.ts` — the consent gate, scrubs, disclosures, A2P steps.
- **Attribution**: `lib/attribution.ts` — the funnel + ROI math.
- See [`CONTRACTS.md`](CONTRACTS.md) for the full internal interface map.

```
Inbound:      caller → (Twilio) → Vapi/Retell + Claude → qualify → Cal.com → Supabase → dashboard
Reactivation: consented CSV → re-consent gate → Twilio SMS (Claude-written) → reply booked → dashboard
```

## Production swaps (documented, not built — keep the MVP small)

| Demo | Production |
|---|---|
| SQLite | Supabase Postgres + RLS by `businessId` |
| Demo brain | Claude Haiku via `ANTHROPIC_API_KEY` |
| Browser Web Speech voice | Vapi/Retell voice agent on a Twilio number |
| Simulated SMS | Twilio A2P 10DLC (one Standard Brand per client, client's US EIN) |
| Cookie tenant switch | Supabase Auth |

## Compliance is built in (the non-negotiables)

Only a client's **own, consented** list is ever messaged; automated SMS/AI-voice needs
**prior express written consent (PEWC)** per lead; the agency is a **co-sender → directly
liable** ($500–1,500/msg); A2P registered under the **client's US EIN**; every AI call
hard-codes **AI-identity + recording disclosure + opt-out**; **DNC + Reassigned-number**
scrubs before every campaign; **never** promise projected earnings — sell booked/held jobs.
