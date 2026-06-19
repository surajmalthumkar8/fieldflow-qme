# AI & Infrastructure Plan — where AI is used, what it costs, what you actually need

**Date:** 2026-06-16 · **Status:** PLAN ONLY (no build) · **For:** the FieldFlow / QME engine
**Grounded in:** [SESSION-HANDOFF.md](../SESSION-HANDOFF.md), [VALIDATED-STRATEGY.md](validation-and-strategy/VALIDATED-STRATEGY.md), the built app ([qme-app/](../qme-app/)), and RevSquared's live [features](https://revsquared.ai/features/) + [after-hours audit](https://revsquared.ai/tools/after-hours-audit) pages. All prices verified against live sources (June 2026) — see Sources.

> **Read this first — three things that are being conflated in the question.** Clearing these up answers half of it:
>
> 1. **"Claude Code" ≠ "Claude Haiku API."** *Claude Code* is the developer tool used to **build** this app (a subscription you pay during development). *Claude Haiku API* is the model the **product calls at runtime** to talk to customers. They are different line items: one is a build cost, one is a per-client running cost. Building the app does **not** add to per-client cost.
> 2. **LangChain is a code library, not a host and not storage.** It does not "run" anywhere by itself and it stores nothing. It is one optional way to *structure* your LLM calls inside code that you already host. So "LangChain or S3?" and "agents run on LangChain or n8n?" are category errors — LangChain isn't an alternative to S3 (storage) or to n8n (a workflow runtime). See §4–§5.
> 3. **Where code "runs" ≠ where the LLM runs.** Your app logic runs on **Vercel** (or any Node host). The **voice agent loop** runs in **Vapi/Retell's cloud**. The **LLM (Claude)** runs on **Anthropic's servers** (you just call the API). Nothing about that requires LangChain or n8n.

---

## 1. Where AI is used in this project (the touchpoint map)

There are **five** AI touchpoints. All five are already implemented in the MVP via one dual-mode "brain" (`qme-app/lib/ai/brain.ts`) — in production they call **Claude Haiku**.

| # | Touchpoint | What the AI does | Model | Where it runs | Cost driver |
|---|---|---|---|---|---|
| 1 | **Inbound voice receptionist** | Greets, qualifies, answers FAQs, books, escalates — by phone | Claude Haiku (the "brain") **inside Vapi/Retell** | Vapi/Retell cloud (they run STT→LLM→TTS); LLM = Anthropic | **Voice minutes** (the big one) |
| 2 | **Reactivation SMS — write the opener** | Drafts the campaign text for the consented list | Claude Haiku | Your Next.js API route (Vercel) → Anthropic API | LLM tokens (tiny) |
| 3 | **SMS reply handling / qualification** | Reads each reply, qualifies, drives to a booked time, honors STOP | Claude Haiku | Next.js API route → Anthropic API | LLM tokens (tiny) |
| 4 | **FAQ grounding (RAG-lite)** | Answers "do you finance? are you licensed?" from the tenant's own FAQ/knowledge base | Claude Haiku + a small vector lookup | Next.js / Vapi; embeddings in Supabase pgvector | LLM tokens + trivial storage |
| 5 | **Post-call analysis** | Summary + sentiment + outcome-reason for every call/text (this is the attribution data) | Claude Haiku | Next.js API route → Anthropic API | LLM tokens (tiny) |

**The one-line takeaway:** AI is the *brain* at 5 points, but the **cost is almost entirely the per-minute voice on inbound calls (touchpoint #1)** — not the LLM tokens, not LangChain, not storage.

---

## 2. Claude Haiku API cost — and why it's NOT your cost problem

**Price (verified):** Claude **Haiku 4.5** = **$1 per million input tokens, $5 per million output tokens**. Up to **90% off with prompt caching**, **50% off with the Batch API**. ([Anthropic](https://www.anthropic.com/claude/haiku), [CloudZero](https://www.cloudzero.com/blog/claude-api-pricing/))

**What a real interaction costs:** a typical SMS qualification turn or post-call summary is ~1–2K input + ~200 output tokens ≈ **$0.002–0.004 per turn**. Even **1,000 AI turns/month for a client ≈ $2–4**. The voice brain inside a call is a bit more (more turns), but still cents per call.

> **Conclusion:** Claude Haiku tokens are effectively a rounding error — **low single-digit dollars per client per month.** Use Haiku for everything high-volume (SMS, qualification, summaries, FAQ). Only reach for Sonnet/Opus for rare, hard reasoning (you almost never need it here). This matches the validated model: variable cost is dominated by voice, not the LLM.

**Claude Code (the build tool) is a separate, one-time-ish cost:** it's your developer subscription (e.g., a Claude Pro/Max plan) used to *write* the app. It is **not** part of per-client running cost and does not scale with clients.

---

## 3. The real cost driver: voice minutes (Vapi or Retell)

The inbound receptionist runs on a managed voice platform — **do not build voice yourself** (per the strategy). Base rates are advertised low but the *all-in* per-minute (orchestration + LLM + speech-to-text + text-to-speech + telephony) is what you pay:

| Platform | Advertised base | Realistic all-in / min | Notes |
|---|---|---|---|
| **Vapi** | $0.05/min | **~$0.13–0.25/min** | More build control |
| **Retell** | $0.07/min | **~$0.13–0.31/min** | Strongest fit for a managed receptionist (mature inbound, warm transfer, typed post-call analysis = your dashboard feed) |

([Famulor](https://www.famulor.io/blog/ai-voice-agent-pricing-2026-what-10-platforms-actually-cost-per-minute), [Retell](https://www.retellai.com/blog/vapi-ai-review), [CloudTalk](https://www.cloudtalk.io/blog/vapi-ai-pricing/))

**Per-client monthly voice cost = answered minutes × ~$0.15–0.25.**
- Small shop, ~250 answered min/mo → **~$40–65/mo**.
- Busy HVAC in peak summer, ~3,000 min/mo → **~$450–750/mo** (this is exactly the margin-inversion risk D11 in the strategy — enforce **per-client usage caps + overage billing**).

**Recommendation:** start on **Retell** for the receptionist. Pick Haiku as the in-platform LLM to keep the per-minute LLM slice cheap.

---

## 4. Do you need LangChain? — **No, not for the MVP**

**What LangChain is:** an open-source code library for chaining LLM calls, tools, and memory. **LangGraph** is its graph/state-machine cousin for complex multi-step agents.

**Do you need it here? No — skip it.** Why:
- Your "agent" is a **single structured-output call per turn** with light state. Claude's **native tool-use + structured outputs** already cover function-calling (e.g., `book_appointment`, `check_availability`) — no orchestration library required.
- The **voice** orchestration is done **by Vapi/Retell**, not by you — LangChain would duplicate it.
- The validated strategy explicitly **defers LangGraph to v2** ("start with a prompt + branching"). Adding LangChain now is complexity with no payoff and a debugging tax.

**When LangChain/LangGraph *would* earn its place (later):** genuinely multi-step, branching agent flows you must control deterministically in your own code — e.g., a multi-tool research/dispatch agent, or complex retry/verification graphs. Not the receptionist, not reactivation.

**Cost of LangChain:** the library is **free (open-source, MIT)**. The only paid piece is **LangSmith** (their observability/eval product) — free tier, then ~**$39/user/mo** (or usage-based). Optional, and you can get the same call logging from Retell/your own DB for $0.

> **LangChain is not storage and not a host.** It never replaces S3, Supabase, or where your code runs.

---

## 5. Where do the agents actually run? (LangChain vs n8n is the wrong axis)

| Layer | Runs where | Why |
|---|---|---|
| **Voice agent loop** (listen→think→speak) | **Vapi/Retell cloud** | They host STT/TTS/telephony + the LLM loop |
| **The LLM (Claude Haiku)** | **Anthropic's API servers** | You just send requests |
| **Your app logic** (SMS routes, qualification, compose, post-call analysis, dashboard, booking writes) | **Vercel** (Next.js API routes / serverless) — or any Node host | This is the code in `qme-app/` today |
| **Database** | **Supabase (Postgres + pgvector)** in prod (SQLite in the demo) | leads, conversations, bookings, consent, embeddings |
| **Booking calendar** | **Cal.com** | slot availability + booking |
| **SMS / numbers / A2P** | **Twilio** | sending + compliance |

**Where does n8n fit?** n8n is a **workflow-automation runtime** (a visual "glue" engine for webhooks → steps → actions). It is **not** where the LLM runs and **not** an alternative to LangChain in any meaningful sense.
- **MVP: you do not need n8n.** Your Next.js API routes already do the glue (webhook in → run brain → write DB → alert owner). The strategy lists **n8n + GoHighLevel as "scale-phase, not MVP."**
- **Later:** n8n is useful as the cross-tool bus once you have many clients/integrations (missed-call trigger → upsert CRM → fire reactivation → Slack alert), or to avoid GHL lock-in.
- **Cost:** n8n **Cloud ~$20–50/mo**, or **self-host for $0** (just a small server). Defer until it pays for itself.

**Bottom line:** for the MVP, "the agents run" = **Retell (voice) + your Next.js routes (text/logic) + Anthropic (the model)**. No LangChain, no n8n.

---

## 6. Storage plan — recordings, transcripts, voice notes (S3 vs Glacier)

You have **two** storage needs; neither is "LangChain."

**(a) RAG / knowledge base (FAQ embeddings) — small, hot.** Store in **Supabase pgvector** (already in the stack). Size is tiny (KBs per client). Cost: **inside the Supabase free/Pro tier** — effectively $0 marginal.

**(b) Call recordings + transcripts — the compliance + attribution asset.** TCPA/state law (and your moat) require **retaining consent + recordings for 5 years**. Plan a **hot → cold lifecycle**:

| Stage | Where | Price (verified) | Use |
|---|---|---|---|
| **Live / recent (0–90 days)** | **S3 Standard** | **$0.023 / GB-month** | Dashboard playback, active case studies, QA |
| **Archive (90 days–5 yr)** | **S3 Glacier Deep Archive** (lifecycle rule auto-moves them) | **$0.00099 / GB-month** (~23× cheaper) | Legal retention; rarely retrieved |

([AWS S3 pricing](https://aws.amazon.com/s3/pricing/), [CloudZero](https://www.cloudzero.com/blog/s3-pricing/))

**Cost math (it's tiny):** a call recording is ~**0.5–1 MB per minute** (compressed audio). Say a client generates **2,000 recorded minutes/month ≈ ~2 GB/month**.
- Recent 90 days hot ≈ ~6 GB on S3 Standard → **~$0.14/mo**.
- A **full 5-year archive** for that client ≈ ~120 GB in Glacier Deep Archive → **~$0.12/mo**.
- **Per client: well under $1/month** for all recording storage. Transcripts are text — negligible.

**Important nuance — you may not need S3 at all on day 1:** **Twilio, Vapi, and Retell already store recordings** and give you URLs (Twilio: recording storage **$0.0005/min/mo**, processing **$0.0025/min**, first **10,000 min free**). The MVP just keeps the provider's recording URL on the `Conversation` row (it already has a `recordingUrl` field). **Add your own S3 + Glacier lifecycle when** you want (i) guaranteed 5-year retention independent of the vendor, (ii) to stop paying provider storage at scale, or (iii) portable attribution evidence you control. **Glacier is for the archive tail, not primary storage** — and note Glacier *retrieval* is slow/expensive, so keep the recent window on S3 Standard.

> **So: "S3 or just LangChain?" → S3 (with a Glacier lifecycle) is the right answer for recordings; LangChain has nothing to do with storage. And you can defer even S3 by using the provider's built-in recording storage at first.**

---

## 7. Full per-client monthly cost model (what it actually adds up to)

| Line item | Provider | Typical small client | Peak/busy client |
|---|---|---|---|
| Inbound voice minutes | Retell/Vapi | $40–65 | $450–750 |
| Claude Haiku tokens (SMS, qualify, summaries, FAQ) | Anthropic | $2–5 | $5–15 |
| SMS sends (reactivation, reminders) | Twilio + carrier | $5–40 (campaign-driven) | $20–60 |
| A2P 10DLC carrier fees (ongoing) | Twilio | ~$2–10 | ~$2–10 |
| Recording/transcript storage | Provider or S3+Glacier | <$1 | $1–3 |
| **Per-client variable total** | | **~$50–120/mo** | **~$480–840/mo (peak)** |

**Shared (not per client):** Supabase Pro **$25/mo**, Vercel Pro **$20/mo**, optional LangSmith **$39/mo**, optional n8n **$20–50/mo**. One-time per client: A2P Standard Brand **$46** + campaign **~$15**.

This confirms the validated economics: **~$50–170/mo variable at normal volume**, dominated by voice — and the margin-inversion risk is real only at peak-season voice, mitigated by **usage caps + overage billing**. Retainers ($2.5–5.5k) keep margin >70%.

---

## 8. Recommendation — the lean MVP stack vs. scale-phase

**Build/keep now (MVP):**
- **Claude Haiku** for all AI touchpoints (cheap, fast). Native tool-use + structured outputs for booking.
- **Retell** (or Vapi) for the inbound voice agent.
- **Next.js API routes on Vercel** as the glue + logic (already built).
- **Supabase** (Postgres + pgvector) for data + FAQ embeddings.
- **Twilio** (SMS/A2P) + **Cal.com** (booking).
- Recordings: **use the provider's recording URLs** first.
- **No LangChain. No n8n. No S3 yet.**

**Add only when a trigger hits (scale-phase):**
- **S3 + Glacier lifecycle** → when you want vendor-independent 5-year retention / lower storage cost at volume.
- **n8n** → when cross-tool orchestration across many clients gets messy.
- **LangChain/LangGraph** → only if you build a genuinely complex multi-step agent.
- **LangSmith** → if you want richer eval/observability than your own logs.

---

## 9. RevSquared check (what they ship vs. our plan)

RevSquared's features ([live](https://revsquared.ai/features/)): **AI Phone Agent, Lead Qualification, Appointment Booking, AI Sales Manager (reviews 100% of calls + coaching), After-Hours Coverage, Call Analytics dashboards.** Their [audit tool](https://revsquared.ai/tools/after-hours-audit) places **5 test calls → Coverage Grade A–F + modeled lost revenue + 1-star-review receipts** (we already cloned this as `/audit`). Their gaps we exploit: they sell "an AI agent" and show *projected/booked* revenue, push compliance onto the customer, and have **no held-job attribution**. Our plan keeps the **held-$ attribution ledger + recorded-call evidence + built-in compliance** as the differentiator — and notably, none of that requires LangChain, n8n, or S3 to exist on day one.

---

## Sources
- Claude Haiku 4.5 pricing — [Anthropic](https://www.anthropic.com/claude/haiku), [CloudZero](https://www.cloudzero.com/blog/claude-api-pricing/), [Finout](https://www.finout.io/blog/anthropic-api-pricing)
- Vapi/Retell per-minute — [Famulor](https://www.famulor.io/blog/ai-voice-agent-pricing-2026-what-10-platforms-actually-cost-per-minute), [Retell review](https://www.retellai.com/blog/vapi-ai-review), [CloudTalk](https://www.cloudtalk.io/blog/vapi-ai-pricing/)
- AWS S3 / Glacier Deep Archive — [AWS](https://aws.amazon.com/s3/pricing/), [CloudZero](https://www.cloudzero.com/blog/s3-pricing/)
- Twilio SMS / A2P / recording storage — [Twilio SMS pricing](https://www.twilio.com/en-us/sms/pricing/us), [Twilio A2P fees](https://help.twilio.com/articles/1260803965530), [Twilio recording](https://support.twilio.com/hc/en-us/articles/223132527-How-much-does-it-cost-to-record-a-call)
- RevSquared — [features](https://revsquared.ai/features/), [after-hours audit](https://revsquared.ai/tools/after-hours-audit)
