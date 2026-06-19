# Techaegis AI — Research Findings

_Market + technology research for the real-estate AI receptionist. Benchmarked against RevSquared AI. Last updated 2026-06-17._

> Sourcing: primary vendor pages where possible; third-party/aggregator figures (esp. some pricing) are **flagged ⚠**. Competitor pricing changes often and is frequently demo-gated.

---

## 1. Competitor Analysis — RevSquared AI (revsquared.ai)

**What it is:** an AI **phone receptionist** for service businesses. Tagline *"Put the phone down."* Core promise: "answers every call, qualifies the lead, and books the job 24/7." Positioned around recovering missed-call revenue and work-life balance — **not** around real estate.

**Features (verified):**
- **AI phone agent** — inbound calls, ~0.4s average answer time; claims 97% of callers say it sounds human.
- **AI Sales Manager** — nightly review of 100% of call transcripts, assigns an *"Agent Score"* (e.g. 72/100), surfaces what went well/poorly, proposes plain-English fixes A/B-tested against the call library. **This is agent-performance coaching, NOT lead scoring** — there are no hot/warm/cold tiers and no lead-routing taxonomy.
- **Plain-English editing ("Prompt Adjuster")** — change agent behavior in natural language. (Genuinely strong, sticky feature — we should match it.)
- **Voice cloning** — clone your voice from ~30s, or pick from **50+ studio TTS voices**.
- **Website chat widget** — same "brain" as the phone agent, but **web is chat-only (no web voice)**.
- **Review automation** (post-job 5-star requests) + **SMS** follow-ups.

**Integrations (40+, native + Zapier):** CRM native GoHighLevel/HubSpot/Salesforce; calendars Google/Calendly/Cal.com; telephony Twilio; Slack native, WhatsApp/Teams via Zapier; Housecall Pro native (ServiceTitan/Jobber via Zapier). **Real-estate CRMs (Chime, kvCORE, LionDesk, Real Geeks, Sierra) only via Zapier — no native RE depth.**

**Verticals:** home services (HVAC/roofing/plumbing/electrical), medical/dental, lending, legal, restaurants, cleaning, landscaping. **Real estate is NOT a named vertical.**

**Pricing (published):** Starter $147/mo (from $0.25/min); Business $497/mo (from $0.20/min; adds AI Sales Manager, voice cloning, CRM); Enterprise $997+/mo. No setup fees/contracts. Claims 60+ businesses, 150k+ calls, ~$43,200/mo avg recovered revenue.

**Four exploitable gaps:** (a) no real-estate focus, (b) no true lead scoring/qualification taxonomy, (c) no native RE CRMs, (d) fully cloud SaaS (per-minute billing). All four are exactly where we aim.

---

## 2. Other Competitors

> Note: the original brief's "Verse.io/Conversica" was conflated — **Verse was acquired by NICE in 2024**; Conversica is a separate enterprise vendor. Treated separately.

| Product | Voice | Chat | Lead scoring | Calendar | CRM (RE-native) | SMS / WhatsApp | RE focus | Self-host/local |
|---|---|---|---|---|---|---|---|---|
| **RevSquared** | Phone, 50+ voices + cloning; **no web voice** | Web widget | **No** (agent coaching) | Google/Calendly/Cal.com | GHL/HubSpot/SF native; RE via Zapier | SMS / Zapier | **No** | No |
| **Smith.ai** | Phone (AI + human handoff) | Yes | Partial | Calendly/Acuity | Zapier; few RE-native | SMS / No | Partial | No |
| **Structurely** | In/outbound AI calling + transfer | SMS/email-first | **Yes** (qualify + routing) | (unconfirmed) | **FUB, BoomTown, Lofty, HubSpot, SF** | SMS / No | **Yes (primary)** | No |
| **Ylopo (Raiya)** | Phone, **female TTS**, live transfer | SMS + Messenger | Yes (intent) | Partial | FUB, Sierra, KW Command, Lofty, Real Geeks | SMS+Messenger / No | **Yes (exclusive)** | No |
| **Roof AI** | **None (chat-only)** | Web + Messenger | Partial | Partial | FUB/SF/HubSpot + Zapier | SMS / **WhatsApp** | **Yes (exclusive)** | No |
| **Synthflow** | Phone + **web voice widget**; ElevenLabs **female** | Omnichannel | Partial | Google/Calendly/Cal.com/Acuity | 200+ (HubSpot/SF/Pipedrive/GHL/Zoho) | SMS / **WhatsApp** | Yes (template "Paul") | No |
| **Verse.ai** (NICE, 2024) | Phone + transfer; SMS-primary | Web + RCS | Yes (labels unnamed) | Partial | SF/HubSpot | SMS/RCS / No | Yes | No |

Pricing (published where noted; **⚠ = third-party**): Structurely **Team $499/mo +$0.08/action ($2k onboarding); Company $999/mo +$0.06/action ($2.5k)**. Roof AI **Free (≤5 leads); Core $299/mo; Intelligence $599/mo**. Synthflow **PAYG ~$0.11–0.16/min all-in +$20/concurrency**. Ylopo ⚠~$795/mo+$1.5k setup. Verse ⚠~$5,000/mo. Smith.ai ⚠~$95–$800 (AI) / live handoff +$3/call (confirmed). Context: CINC "Alex" (text/email only, no voice, ~$200/mo), Goodcall ($79/$129/$249, phone-only), Conversica (~$2,999/mo, not RE).

**Cross-cutting findings:**
- **Nobody offers self-hosted/local** — our clean differentiator (privacy + no per-minute cloud bill).
- **No one publishes explicit hot/warm/cold + opportunity-size scoring** — all do generic "intent." A transparent, labeled scoring model is an open positioning gap.
- **Web *voice* widget** (vs phone-first) confirmed only for **Synthflow** — our most direct analog and benchmark.
- **WhatsApp** is rare (only Roof AI + Synthflow). **Female TTS** confirmed only for Ylopo + Synthflow.

---

## 3. Technology Research (local, low-cost stack)

### A. Local LLMs via Ollama

| Family | Reasoning | Conversation | Tool/JSON | Footprint @Q4 | Speed |
|---|---|---|---|---|---|
| **qwen3 / qwen2.5** | Strong (toggleable thinking) | Strong | **Best of set** | 8–9B ≈ 5–6 GB | Fast |
| **mistral-nemo 12B** | Good | **Warmest prose**, 128K ctx | Good | ≈ 7 GB | Moderate |
| **phi3 / phi4** | High per-param (STEM) | Adequate | **Weak — avoid for tools** | 3.8B ≈ 2.2 GB | Very fast |
| gemma3 | Good (+vision) | Very good | Weaker tools | 4B ≈ 3.3 GB | Fast |
| llama3.x | Good | Good | Good, mature | 8B ≈ 4.7 GB | Fast |
| deepseek-r1/v3 | **Top reasoning** | Verbose | R1 JSON polluted by think traces | distills ≈ 5 GB; full infeasible local | distills fast |

Installed: `qwen3.5:9b`, `mistral-nemo:12b`, `phi3:3.8b`, `qwen2.5-coder:1.5b`, `qwen3-vl:8b`, plus `nomic-embed-text` (added for RAG).

**Role → model mapping.** Two defensible options:
- **As implemented:** receptionist + qualifier → `qwen3.5:9b`; summaries → `mistral-nemo:12b`; fast classify → `phi3:3.8b`.
- **Research recommendation (worth A/B-testing):** receptionist conversation → **`mistral-nemo:12b`** (warmest, 128K ctx for long histories); qualification/scoring + summaries → **`qwen3.5:9b` with thinking OFF** (best tool/JSON of the set); `phi3` as lightweight fallback.

Both work; the split mainly trades conversational warmth (mistral-nemo) vs. one fewer model in memory (qwen3.5 for everything). **No new chat models needed.** Only required addition was an **embeddings model** — done (`nomic-embed-text`; `bge-m3` is an alternative).

**Critical operational findings (from the build):**
- **Disable qwen3.x "thinking"** (`think:false` / `/no_think`) on structured calls — otherwise it emits minutes of reasoning tokens and stalls/garbles JSON. This was the single biggest latency/reliability fix.
- **Cold model load ≈ 40s** for a 9–12 GB model — keep warm (`OLLAMA_KEEP_ALIVE`) or pre-warm for demos.
- **⚠ Verify the `qwen3.5:9b` tag provenance** — there's no widely-documented official "Qwen3.5 9B." Consider repinning to official `qwen3:8b` for production.

### B. Local female TTS — **Kokoro validated ✅**

| Engine | Quality | CPU-only | Footprint | Commercial license | US female |
|---|---|---|---|---|---|
| **Kokoro-82M** | Excellent for size | **Yes, real-time** | ~tens–300 MB | **Apache-2.0 ✅** | **Yes (`af_*`)** |
| Piper | Good, slightly robotic | Yes | Tiny | MIT | Some |
| Coqui XTTS v2 | Very high (cloning) | Marginal | ~1.8 GB | **Non-commercial ⚠ disqualified** | Yes |
| OpenVoice v2 | High (cloning) | Marginal | Moderate | MIT | Cloning only |
| Fish Speech | Very high | Limited | Larger | Mixed ⚠ | Cloning |

**Kokoro is the right call** — best naturalness-for-size, true CPU real-time, tiny, commercial-friendly license, ready US female voices. Specifics:
- Model: `hexgrad/Kokoro-82M`; for CPU use `onnx-community/Kokoro-82M-v1.0-ONNX` via `kokoro-onnx`.
- **US female voices:** `af_heart` (grade A — use as default), `af_bella` (A-). lang_code `'a'` = American English; 24 kHz mono.
- Install: `pip install kokoro-onnx soundfile`, drop model files into `backend/voices/` (service auto-switches). The phonemizer path pulls espeak-ng (GPL) — prefer the ONNX route for English to avoid bundling it.
- _Current state:_ service ships with a macOS `say`/Samantha fallback so `/voice` works today; Kokoro auto-activates once model files are present.

### C. STT (speech-in)
- **Recommended: `faster-whisper` `small.en` (or `base.en`), int8, CPU** — Whisper-grade (~5–6% WER), ~4× faster, ~1 GB RAM, $0, full privacy (caller PII stays local).
- **Browser Web Speech API** — prototyping only (ships audio to Google/Apple). Fine for the current demo, not for production caller data.
- **whisper.cpp (WASM)** — if fully in-browser STT is ever wanted.

### D. RAG + orchestration
- **RAG storage/retrieval:** **pgvector** on the existing Postgres (chosen — one datastore, no Pinecone cost; HNSW cosine). Embeddings `nomic-embed-text` (768-dim). Implemented in `backend/app/rag.py`.
- **RAG framework:** kept **framework-light** for v1 (direct chunk→embed→search). **LlamaIndex** is the recommended upgrade when we add many loaders (PDF/CSV/MLS/web) + rerankers — first-class Ollama integration.
- **Orchestration / typed output:** **PydanticAI** is the recommended next step — validated typed outputs (e.g. a `Lead` model) with a native `ollama:` provider, replacing hand-rolled JSON parsing. **Skip LangGraph/CrewAI/AutoGen** — this is single-agent + light RAG, not multi-agent (revisit LangGraph only if human-in-loop state grows).

---

## 4. Recommendations — how we beat RevSquared in the RE niche

**Our stack (all local, ~$0 marginal cost):** conversation `mistral-nemo:12b` (or `qwen3.5:9b` if RAM-tight) · qualification/scoring + summaries `qwen3.5:9b` (thinking off) · fallback `phi3:3.8b` · TTS Kokoro-82M ONNX `af_heart` (24 kHz) · STT faster-whisper `small.en` int8 · RAG pgvector + `nomic-embed-text` · orchestration → PydanticAI (next).

**Where we win:**
1. **Real-estate native** — RevSquared explicitly doesn't target RE. We own buyer/seller/renter intent, MLS/listing grounding (RAG), and native RE CRMs (Follow Up Boss, BoomTown, Sierra, kvCORE/BoldTrail, Lofty) where RevSquared only reaches them via Zapier.
2. **Real lead scoring nobody publishes** — transparent **hot/warm/cold + opportunity-size** with reasons. RevSquared's "AI Sales Manager" coaches agents; it does not score leads. ✅ implemented (`/qualify`).
3. **Local / self-hosted** — no competitor offers it. Privacy (caller PII never leaves the box) + **no per-minute cloud bill** (RevSquared $0.20–0.25/min; Synthflow ~$0.11–0.16/min). Our marginal cost ≈ electricity — also the strongest pricing wedge.
4. **Web *voice* widget for site visitors** — only Synthflow has it; the phone-first incumbents don't. Engaging a live website visitor by voice + chat and routing hot leads to a human in real time is our core scenario.
5. **Female TTS as a brand choice** — `af_heart`, on par with Ylopo/Synthflow but local and license-clean.

**Table-stakes to match:** plain-English **prompt editing** (copy RevSquared's "Prompt Adjuster"), calendar booking (Google/Calendly/Cal.com), live human handoff/transfer, and call/transcript review.

**Open flags:** verify the `qwen3.5:9b` tag provenance; Ylopo/Verse/Smith pricing tiers are third-party; some competitors' calendar providers and WhatsApp support are unconfirmed; confirm RevSquared details against the live site before external positioning.

## Sources
revsquared.ai (site / pricing / integrations) · structurely.com · ylopo.com · getroof.ai · synthflow.ai · verse.ai (NICE) · smith.ai · ollama.com/library · hexgrad/Kokoro-82M + onnx-community/Kokoro-82M-v1.0-ONNX (HF) · faster-whisper (GitHub) · LlamaIndex + PydanticAI docs. _(Full URLs available on request.)_
