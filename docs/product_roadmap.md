# Techaegis AI — AI Receptionist Product Roadmap

_Owner: Techaegis AI · Target market: US real-estate (agencies, brokers, realtors, investment firms) · Benchmark: revsquared.ai · Last updated: 2026-06-17_

---

## 1. Current State

The working product is a **Next.js 15 home-services QME engine** (full map in [`codebase_reference.md`](./codebase_reference.md)). It already does a surprising amount of what an AI receptionist needs:

- ✅ A conversational AI receptionist (voice/text) with a dual-mode brain (Claude Haiku or a zero-key demo state machine).
- ✅ Two-step, tool-gated **appointment booking** with availability + read-back confirmation.
- ✅ Conversation + transcript persistence, post-turn **sentiment**, basic qualification flag, outcome/reason categorization.
- ✅ A multi-page operator dashboard (leads, conversations, compliance, config, audit) + ROI/attribution math.
- ✅ A tenant-config model (`Business`) driving prompts/FAQ/escalation per client.
- ✅ Compliance scaffolding (TCPA disclosures, consent states, DNC/reassignment scrub, opt-out, audit trail).

What is **not** there yet:

- ❌ Real authentication / sessions / JWT (tenant = a cookie).
- ❌ A real backend service — everything is Next.js API routes; the `backend/` Python folder is an empty/wrong stub.
- ❌ Local LLM (Ollama) usage — the brain is Anthropic-only or demo.
- ❌ Server-side / female voice — only the browser Web Speech API.
- ❌ A real lead-scoring engine (lead score / intent score / budget estimate / opportunity size).
- ❌ Real-estate domain (everything is HVAC/roofing).
- ❌ A per-business knowledge base / RAG with real ingestion.
- ❌ External integrations (Gmail/Outlook/Calendar/WhatsApp/Slack/Teams/CRM).
- ❌ Website-facing widgets (chat bubble, live-agent handoff, feedback form, receptionist avatar).

## 2. Gap Analysis (vs. the mission)

| Capability the mission requires | Today | Gap |
| --- | --- | --- |
| Engage website visitors | Operator-facing demo page only | Need an **embeddable web widget** (chat + voice + avatar) |
| Natural conversation | Brain exists | Re-skin to real estate; move to local Ollama persona |
| Understand intent | Implicit in brain | Need explicit **intent score** |
| Qualify lead | `qualified` boolean | Need structured real-estate qualifying flow |
| Score lead | None | Need **lead score / intent / budget / opportunity / sentiment** |
| Hot/Warm/Cold | None | Need a classifier + thresholds |
| Schedule meetings | ✅ booking flow | Wire to Google/Microsoft Calendar |
| Notify sales team | Escalate action only | Need Slack/email/Teams notifications + routing |
| Store history + summaries | ✅ transcripts | Add LLM **conversation summaries** |
| Voice (female) | Browser TTS | **Kokoro** server TTS with a natural US female voice |
| Multi-channel | Voice + SMS | WhatsApp/Slack/Teams later |
| Auth / multi-tenant | Cookie | **JWT + sessions + RLS-style isolation** |
| Knowledge base | FAQ keyword match | **pgvector RAG** per business |
| Feedback | None | Simple (non-AI) website feedback form |

## 3. Missing Features (build list)

1. **Auth & sessions** — JWT login, session store, agent/admin users, per-tenant scoping.
2. **FastAPI AI/voice microservice** — chat, lead-qualification, summarization, voice endpoints, backed by Ollama; RAG over pgvector.
3. **Lead engine** — lead score, intent score, budget estimate, opportunity size, sentiment → Hot/Warm/Cold.
4. **Real-estate re-skin** — domain model, prompts, qualifying flow, seed data, UI copy.
5. **Per-business knowledge base** — schema + ingestion + retrieval (pgvector + nomic-embed-text); ingestion pluggable/deferred until client data exists.
6. **Female voice** — Kokoro TTS endpoint, receptionist persona.
7. **Website experience** — embeddable widget (chat/voice/avatar), live-agent handoff, feedback form, lead dashboard.
8. **Integrations** — Gmail/Outlook/Google+Microsoft Calendar (P1) → WhatsApp/Slack/Teams (P2) → CRM (P3).

## 4. Recommended Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│  • Operator dashboard (Next.js RSC)                                  │
│  • Embeddable receptionist widget (chat + voice + avatar)            │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ HTTP                           │ HTTP/WS
        ┌───────▼────────┐              ┌────────▼─────────────────────┐
        │  Next.js app    │  internal   │  FastAPI AI/Voice service     │
        │  (UI + CRUD     │────HTTP────▶ │  • JWT auth + sessions        │
        │   API routes)   │             │  • /chat  /qualify  /summarize│
        │                 │             │  • /voice (Kokoro TTS)        │
        │                 │             │  • /kb (RAG ingest + retrieve)│
        └───────┬─────────┘             └───────┬───────────────────────┘
                │ Prisma                        │ SQLAlchemy/asyncpg
                └──────────────┬────────────────┘
                       ┌───────▼────────┐        ┌──────────────┐
                       │ PostgreSQL 14   │        │  Ollama      │
                       │  + pgvector     │        │  qwen3.5:9b  │
                       │ (app + sessions │        │  mistral-nemo│
                       │  + KB vectors)  │        │  phi3 + embed│
                       └─────────────────┘        └──────────────┘
```

**Principles applied** (per the engineering mandate): one datastore (Postgres+pgvector, no Pinecone), local models (no per-token cost), additive (Next.js keeps working while FastAPI is built), and a clean swap pattern (live vs. demo, cloud vs. local) already native to the codebase.

Decisions (locked):
- **Postgres + pgvector** for everything incl. vectors — not Pinecone (simplicity, cost).
- **FastAPI as a separate microservice**; Next.js stays the UI + light CRUD and calls it.
- **Kokoro** local female TTS.
- **Full real-estate re-skin** (not a second vertical).

## 5. AI Stack Recommendations

**No new chat-model pulls needed for v1** — the machine already has strong models. Role → model mapping:

| Role | Model | Why |
| --- | --- | --- |
| Receptionist conversation | `qwen3.5:9b` | Best installed mix of reasoning + natural conversation; tool/JSON capable |
| Lead qualification / scoring (JSON) | `qwen3.5:9b` (reasoning) + `phi3:3.8b` fast classifier | Reliable structured output; cheap fallback for booleans/intent |
| Conversation summaries | `mistral-nemo:12b` | Strongest installed writer |
| Embeddings (RAG) | `nomic-embed-text` (768-dim) | Standard, fast, local |
| Vision (future doc/photo) | `qwen3-vl:8b` | Already installed; not needed v1 |

Loaded concurrently, `qwen3.5:9b` + `mistral-nemo:12b` ≈ 14 GB RAM — confirm headroom before parallel calls; otherwise serialize. Detailed model strengths/weaknesses/RAM and voice-model comparison live in [`research_findings.md`](./research_findings.md).

**Voice:** Kokoro TTS (natural US female, CPU-friendly, ~small footprint) as the local default. ElevenLabs remains an optional cloud upgrade behind the same interface. STT: keep browser Web Speech API initially; faster-whisper later for server-side.

## 6. Integration Roadmap

- **Phase 1:** Gmail, Outlook, Google Calendar, Microsoft Calendar — send confirmations/reminders, create meetings.
- **Phase 2:** WhatsApp, Slack, Microsoft Teams — notifications, hot-lead routing, lead summaries to sales.
- **Phase 3:** CRM — HubSpot, Salesforce, Zoho (push qualified leads + scores).

All integrations sit behind adapter interfaces (mirroring the existing `lib/integrations.ts` simulated-vs-live pattern) so they no-op safely without credentials.

## 7. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| **Secrets in `.env`** incl. a LinkedIn password + live API keys (also exposed in chat) | 🔴 High | Rotate the LinkedIn password and the OpenAI/ElevenLabs keys now; never store a personal password in an app `.env`. It is gitignored (not committed) — keep it that way. |
| Local LLM latency/quality vs. cloud | Medium | Keep the dual-mode swap (local Ollama ↔ cloud) so demos can use a faster path; cache, stream, and size context. |
| RAM pressure running 9b+12b + embeddings + Postgres | Medium | Serialize heavy calls; prefer `phi3` for classification; lazy-load models. |
| Two services to run/deploy (Next.js + FastAPI) | Medium | Document a one-command dev startup; containerize later. |
| Compliance (TCPA/recording disclosure) carries over to real estate | Medium | Reuse existing disclosure/consent scaffolding; adapt copy. |
| Scope creep across many integrations | Medium | Ship the core loop first; integrations are adapters added incrementally. |

## 8. Priorities (sequenced)

| # | Milestone | Outcome |
| --- | --- | --- |
| **P0** | Stabilize & boot | ✅ Done 2026-06-17 — app runs clean. |
| **P1** | Docs | This roadmap + codebase reference + research findings. |
| **P2** | Postgres + pgvector migration | Move off SQLite; add auth/session + knowledge-base tables. |
| **P3** | FastAPI AI/voice service | JWT auth + sessions; Ollama-backed `/chat` `/qualify` `/summarize`; RAG endpoints. |
| **P4** | Real-estate re-skin + lead engine | Real-estate domain, qualifying flow, Hot/Warm/Cold + scores. |
| **P5** | Kokoro female voice | Natural female TTS on a `/voice` endpoint + persona. |
| **P6** | Website widget | Embeddable chat/voice/avatar + live-agent handoff + feedback form. |
| **P7** | Integrations | Calendar/email → messaging → CRM. |

Deliver the working core loop (P2–P5) before breadth (P6–P7). Optimize later.
