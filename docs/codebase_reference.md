# FieldFlow / QME Engine — Codebase Reference

_Snapshot taken 2026-06-17, before the Techaegis AI real-estate re-skin. This is the "as-found" map of the system._

## 1. What the app is today

A **Next.js 15 (App Router)** application — a "Qualified Meetings Engine (QME)" originally built for **home-services contractors** (HVAC / roofing). It runs an AI receptionist + a dormant-customer reactivation engine, books appointments, and attributes revenue. It runs end-to-end with **no API keys** (deterministic demo brain + simulated adapters).

There is **no separate backend** in the working app — all server logic lives in Next.js API routes. The `backend/` Python folder is a non-functional stub (see §7).

## 2. Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15.5.19 (App Router, React Server Components), React 19 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS v3.4 |
| ORM / DB | Prisma 6.5 → **SQLite** (`prisma/dev.db`); schema noted as 1:1 portable to Supabase Postgres |
| AI brain | `@anthropic-ai/sdk` — Claude Haiku when `ANTHROPIC_API_KEY` set, else deterministic demo brain |
| Voice | Browser Web Speech API only (client STT/TTS). No server TTS. |
| Charts | recharts; CSV via papaparse; validation via zod |
| Auth | **None** — tenant selection is a cookie |

## 3. Directory map

```
app/
  (app)/                 authenticated-style shell (no real auth) — dashboard, receptionist,
                         reactivation, leads, compliance, config, conversations, audit
  api/                   server routes (the de-facto backend):
    voice/route.ts         live in-browser AI receptionist turn handler (brain + persistence + booking)
    sms/route.ts           SMS qualifier turn handler
    config/route.ts        read/update Business tenant config
    leads/{upload,scrub,reconsent}/   list import, DNC/reassignment scrub, re-consent
    reactivation/{launch,compose,simulate-replies}/   dormant-list outreach engine
    business/select/       switch active tenant (sets cookie)
  layout.tsx, page.tsx, globals.css

lib/
  ai/brain.ts            dual-mode brain (live Claude / demo state machine), BrainResult contract
  ai/prompts.ts          receptionist + reactivation system prompts; strict JSON RESPONSE_CONTRACT
  config.ts              parse JSON-string columns on Business; HIGH_TICKET_THRESHOLD ($5k)
  types.ts               domain types + parsed Business config shapes + brain contract
  session.ts             active-business cookie (qme_business) — stand-in for auth
  db.ts                  Prisma client singleton
  compliance.ts          TCPA disclosures / footers
  integrations.ts        booking-slot reservation + adapters (simulated unless keys set)
  attribution.ts         ROI / revenue attribution math
  format.ts, cn.ts, nav.ts

prisma/
  schema.prisma          Business, Lead, Conversation, Message, Booking, ComplianceEvent
  seed.ts                seeds 2 demo contractors (HVAC + roofing) with leads/bookings
  seed.sqlite            prebuilt seed snapshot

backend/                 NON-FUNCTIONAL STUB — see §7
docs/                    (new) roadmap / research / this reference
```

## 4. Data model (Prisma) — current

- **Business** — the tenant/config record. Drives every layer (prompt, FAQ/RAG, reactivation copy, A2P campaign, attribution). Holds `trade` (hvac|roofing|…), `services` (JSON `[{name,priceLow,priceHigh,highTicket}]`), `faqs` (JSON), `hours`, `escalation`, commercials (`monthlyRetainer`, `avgJobValue`, …), and compliance/messaging posture (`a2pStatus`, `fromNumber`, …). JSON-ish fields are stored as **text** (SQLite has no JSON type) and parsed in `lib/config.ts`.
- **Lead** — a contact (dormant list or inbound). Heavy on **consent/compliance**: `consentStatus`, `dncStatus`, `reassignedStatus`, `smsEligible`.
- **Conversation** — one voice call or SMS thread. `channel` (VOICE|SMS), `status`, `qualified`, `outcome`, `summary`, `sentiment`, `outcomeReason`.
- **Message** — a transcript turn (USER|ASSISTANT|SYSTEM).
- **Booking** — the unit the product is measured on; walks `BOOKED→CONFIRMED→HELD|NO_SHOW|CANCELLED`. Holds `estimatedValue`, `isHighTicket`, `source`, `revenue`.
- **ComplianceEvent** — audit trail (consent, scrubs, disclosures, opt-outs).

> No `User`/`Account`/`Session` tables — there is no authentication.

## 5. The AI brain (`lib/ai/brain.ts`)

Dual-mode by design so the product works with zero keys:

- **Live** (`ANTHROPIC_API_KEY` set) → Claude Haiku. System prompt from `prompts.ts`, response forced into a strict JSON envelope (`RESPONSE_CONTRACT`): `{reply, qualified, sentiment, reason, action:{type, service, preferredTime, estimatedValue, …}}`. Parsed tolerantly by `parseEnvelope`.
- **Demo** → a deterministic conversation state machine: opt-out detection, emergency escalation, greeting+disclosure, service matching, FAQ keyword grounding (RAG-lite), two-step (offer → read-back → confirm) booking.

Both return the same `BrainResult`, so feature code never branches on which engine ran. On any live error it falls back to demo. Actions are applied in `app/api/voice/route.ts` (persist transcript, create attributed Booking on `book`).

**Relevance to the pivot:** this brain is hard-wired to home-services concepts (services/price ranges, AC/roof keywords, emergency triggers). It must be re-skinned to real-estate intents and replaced/augmented by the local Ollama brain via the FastAPI service.

## 6. Auth & tenancy (today)

`lib/session.ts` keeps an active-business cookie (`qme_business`); no passwords, no sessions, no JWT. Multi-tenant isolation in prod is documented as "Supabase Auth + RLS keyed on `businessId`." The new FastAPI service introduces real JWT auth + Postgres-backed sessions.

## 7. The `backend/` stub (to be replaced)

- `backend/main.py` — **0 bytes** (empty). FastAPI is in `requirements.txt` but nothing is implemented.
- `backend/utils/config.py` — **copied from an unrelated project** (a content/marketing agency multi-agent system). Roles are `writer/humanizer/producer/reel_critic/vision`, and it references folders that don't exist here (`prompts/agents`, `content/research`, `context/techaegisai-facts.md`). It would crash on import. *However*, its `llm_for()` / `gen_structured()` ChatOllama patterns (Ollama structured output, reasoning-then-format, schema-shape prompting) are a useful reference and are being adapted for the receptionist roles.
- `requirements.txt` — langchain, langchain-ollama, langgraph, fastapi[standard], uvicorn, exa/tavily, etc.

## 8. Environment & secrets

`.env` (gitignored) currently holds: `DATABASE_URL`, optional `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, Twilio/Cal.com/Vapi (simulated when blank), plus a grab-bag of other keys (OpenAI, Gemini, Tavily, Exa, HF, ElevenLabs, Pexels) **and a LinkedIn username + password**. See the security note in `product_roadmap.md` §Risks — a LinkedIn password must not live in an app `.env`; rotate it.

## 9. How to run

```bash
npm install
npm run setup     # prisma generate + db push + seed
npm run dev       # http://localhost:3000
```

All 8 pages render and the AI receptionist + booking flow work with no keys (demo brain). Verified booting clean on 2026-06-17.
