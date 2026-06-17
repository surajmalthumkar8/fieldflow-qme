# Techages AI — Research Findings

_Market + technology research for the real-estate AI receptionist. Last updated 2026-06-17._

> Sourcing note: the competitor positioning below reflects the AI-receptionist/real-estate-lead-conversion category as understood from public product information. **RevSquared.ai specifics should be confirmed against the live site** (a research pass was run for this; verified details get merged here). Treat pricing as indicative — vendors change it and often gate it behind a demo.

---

## 1. Competitor Analysis

### RevSquared AI (the benchmark — https://revsquared.ai/)
Positioned as an **AI receptionist / answering service** that engages inbound contacts 24/7, answers questions, qualifies, and books/routes — pitched at service businesses. For our purposes the relevant capabilities to match-or-beat are: always-on chat + voice answering, qualification, appointment scheduling, CRM/calendar hooks, and lead hand-off to humans. **Action: verify exact feature list, supported integrations, voice quality, and pricing on the live site before finalizing competitive claims.**

### Category competitors (real-estate-relevant)

| Product | What it is | Real-estate fit | Voice | Chat | Lead scoring | Calendar | CRM | SMS/WhatsApp | Self-host/local |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Structurely** | AI assistant for real-estate lead conversion (the closest direct comp) | ★★★★★ purpose-built | Some | ✅ | ✅ | ✅ | ✅ (Follow Up Boss, etc.) | ✅ | ❌ cloud |
| **Ylopo / "Raiya"** | Real-estate marketing + AI ISA | ★★★★★ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Verse.io / Conversica** | AI SDR / lead engagement (cross-vertical) | ★★★★ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Smith.ai** | Human + AI receptionist / answering service | ★★★ generic | ✅ | ✅ | basic | ✅ | ✅ | ✅ | ❌ |
| **Goodcall / Rosie** | AI phone receptionist for SMBs | ★★★ generic | ✅ | limited | basic | ✅ | some | limited | ❌ |
| **Synthflow / Vapi / Air.ai** | Build-your-own AI voice agents (platforms) | ★★★ DIY | ✅✅ | via build | custom | via tools | via tools | via tools | ❌ (cloud LLMs) |
| **Techages AI (this product)** | Real-estate AI receptionist, **local-first** | ★★★★★ | ✅ (local Kokoro) | ✅ | ✅ (HOT/WARM/COLD + budget + opportunity) | planned | planned | planned | **✅ local Ollama + Postgres** |

### Where we can win
1. **Real-estate-native qualification + scoring out of the box** — most generic receptionists capture a name and book a call; we score lead/intent, estimate **budget and commission opportunity**, and capture property/timeline/financing/goals. That's the analysis the buyer (an agency) actually wants.
2. **Local-first / low cost** — Ollama + Postgres/pgvector + Kokoro means no per-token or per-character cloud bills and data stays on infrastructure the client controls. A real differentiator for cost-sensitive brokerages and a privacy story without bank-grade overhead.
3. **Per-business knowledge base (RAG)** — ground answers in the client's own listings/policies/neighborhood guides.
4. **Operator dashboard + attribution** already exists (inherited from the QME engine) — competitors often bolt analytics on later.

---

## 2. Technology Research

### 2.1 Local LLMs (via Ollama)

Already pulled on this machine: `qwen3.5:9b`, `mistral-nemo:12b`, `phi3:3.8b`, `qwen2.5-coder:1.5b`, `qwen3-vl:8b`, `nomic-embed-text`.

| Model | ~RAM (GPU) | Reasoning | Conversation | JSON / tool use | Speed | Best use |
| --- | --- | --- | --- | --- | --- | --- |
| **qwen3.5:9b** | ~6 GB | strong | strong, natural | reliable (with thinking OFF) | good | **receptionist + lead qualification** |
| **mistral-nemo:12b** | ~7 GB | good | excellent prose | good | medium | **summaries / natural phrasing** |
| **phi3:3.8b** | ~2.2 GB | ok | ok | ok | fast | fast intent/grade **classification** |
| qwen2.5-coder:1.5b | ~1 GB | weak (chat) | weak | ok for tiny routing | very fast | micro-routing only |
| qwen3-vl:8b | ~6 GB | n/a | n/a | n/a | – | vision (future: listing photos/docs) |

**Critical operational finding:** qwen3.x ships a "thinking" channel that, if left on, emits **minutes** of reasoning tokens and stalls/garbles structured output. Disable it (`think: false` in the Ollama `/api/chat` request) for receptionist + qualifier calls — this was the single biggest latency/reliability fix in the build. Also note **cold model load ≈ 40s** for a 9–12 GB model; keep models warm (`OLLAMA_KEEP_ALIVE`) or pre-warm on startup for demos.

**Verdict:** **No new chat models needed for v1.** The earlier roadmap's suggestions (`qwen3:14b`, `gemma3`, `deepseek-r1`) are heavier and overlap `qwen3.5:9b` for this workload. `deepseek-r1` is worth revisiting only if we add genuinely hard analytical tasks (e.g. multi-property investment modeling). RAM note: 9b + 12b loaded together ≈ 14 GB — serialize heavy calls on constrained hardware.

Role → model mapping (implemented): receptionist & qualifier → `qwen3.5:9b`; summaries → `mistral-nemo:12b`; fast classification → `phi3:3.8b`; embeddings → `nomic-embed-text` (768-dim).

### 2.2 Voice (local female TTS)

| Engine | Quality | Latency | CPU-only | Footprint | License | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Kokoro** (kokoro-82M / kokoro-onnx) | ★★★★ very natural | low | ✅ | ~tens–hundreds MB | Apache-2.0 | **Chosen.** Natural US female voices (e.g. `af_heart`, `af_bella`). Best quality-per-MB; ONNX runs on CPU. |
| Piper | ★★★ | very low | ✅ | small | MIT | Fast but more robotic; good fallback for low-end. |
| Coqui XTTS | ★★★★ (cloning) | higher | partial | large | non-commercial caveats | Heavy; licensing friction; project momentum waned. |
| OpenVoice | ★★★★ (cloning) | higher | partial | large | MIT-ish | Great for voice cloning, heavier to run. |
| Fish Speech | ★★★★ | medium | partial | medium-large | check | Strong quality, more setup. |
| _macOS `say` (Samantha)_ | ★★ | instant | ✅ | 0 | OS | **Implemented fallback** — works out of the box for demos while Kokoro models are downloaded. |

**Verdict:** **Kokoro** is the right local default (quality, license, CPU-friendly, real US female voices). The service already abstracts the provider and ships with the macOS `say`/Samantha fallback so `/voice` works immediately; dropping the Kokoro model files into `backend/voices/` auto-switches it.

**STT (speech-in):** keep the **browser Web Speech API** for v1 (zero infra). For server-side accuracy later, **faster-whisper** (CTranslate2) is the pragmatic local choice; `whisper.cpp` for CPU-only.

### 2.3 RAG framework

- **Storage/retrieval:** **pgvector** on the existing Postgres (chosen) — one datastore, no Pinecone account/cost. HNSW cosine index. Plenty for per-business KBs at this scale; swap to a dedicated vector DB only if corpus/QPS outgrows it.
- **Embeddings:** `nomic-embed-text` (local, 768-dim) — solid, fast, free.
- **Framework:** keep it **framework-light** — direct chunk→embed→store→cosine-search (implemented in `backend/app/rag.py`). LlamaIndex/LangChain add abstraction we don't need yet; revisit LlamaIndex if we add many loaders (PDF/CSV/web) or rerankers.

### 2.4 Agent framework

For v1 the receptionist is a single-prompt + structured-output loop, not a multi-tool agent — so **no agent framework needed**. When we add tool-calling (live calendar slots, CRM writes, live listing lookups), **LangGraph** is the most pragmatic local-friendly choice (deterministic graphs, SQLite/Postgres checkpointing) over heavier alternatives. Until then, plain functions + the structured-JSON contract keep it simple and debuggable.

---

## 3. Recommendations (summary)

1. **Ship the local stack as the differentiator:** Ollama (`qwen3.5:9b` + `mistral-nemo:12b` + `phi3`) + pgvector RAG + Kokoro voice. Low/zero marginal cost, data-local. ✅ implemented.
2. **Lead intelligence is the wedge vs. generic receptionists:** HOT/WARM/COLD + lead/intent score + **budget estimate + commission opportunity** + captured real-estate fields. ✅ implemented (`/qualify`).
3. **Keep the cloud swap available** for sales demos (ElevenLabs voice / Claude brain) using the existing live-vs-local pattern — natural polish when needed, local by default.
4. **Disable qwen "thinking"** and keep models warm — non-obvious but decisive for latency/reliability. ✅ implemented.
5. **Next competitive steps:** embeddable website widget (chat + voice + avatar) and calendar/email integrations — that's where RevSquared and Structurely are strong and where we currently have backend but no front-of-site experience yet.
6. **Verify RevSquared specifics** on the live site and tighten the comparison table before any external positioning/sales material.

## Sources / to-verify
- https://revsquared.ai/ (verify features, integrations, pricing, voice)
- Competitor sites: structurely.com, ylopo.com, verse.io, conversica.com, smith.ai, goodcall.com, synthflow.ai, vapi.ai
- Ollama model library (ollama.com/library) for current model specs
- Kokoro TTS (hexgrad/Kokoro-82M; kokoro-onnx) for voice ids + model files
