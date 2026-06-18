# Techages AI — AI Receptionist (FieldFlow / QME engine)

A **local-first AI receptionist** for **US real-estate** businesses (agencies, brokers, realtors,
investors). A website visitor can **chat or talk** to **Elara**, the AI receptionist — she answers
questions, **qualifies and scores the lead** (Hot/Warm/Cold + budget + opportunity), and **books a
meeting** with conflict-safe scheduling that **emails a real calendar invite**. Everything runs on
**local models** (Ollama + Kokoro voice) so the marginal cost per conversation is ≈ $0.

> Vertical-configurable — real estate today, other verticals via the YAML prompts later.

## What's inside

| Area | What it does |
|---|---|
| **AI Receptionist** (`/receptionist`) | "Elara" — real local-LLM chat + tap-to-talk voice, RAG-grounded, with live transcript. Qualifies, answers, schedules. |
| **Scheduling** | Real availability (timezone-aware: New York / India), **atomic booking** (no double-booking), **.ics calendar invite** emailed + downloadable. |
| **Lead engine** | Hot/Warm/Cold grade + lead/intent score + budget estimate + opportunity size + captured details. |
| **Knowledge base (RAG)** | Per-business docs → pgvector semantic search to ground answers. |
| **Dashboard** (`/dashboard`) | Attribution funnel + ROI. Plus leads, conversations, compliance, config. |
| **Auth** | JWT login + sessions; light/dark mode. |

## Architecture

```
frontend/   Next.js 15 (UI + CRUD API routes, Prisma)        → :3000
backend/    FastAPI service (LangChain→Ollama, JWT, RAG,      → :8000
            Kokoro voice, scheduling+email)
            ├─ Postgres `public` schema  (Prisma: app data)
            └─ Postgres `techages` schema (FastAPI: auth, KB, appointments)
PostgreSQL + pgvector · Ollama (local LLMs) · Kokoro (local TTS)
```

The two services share one Postgres DB safely via **separate schemas** (Prisma → `public`,
FastAPI → `techages`), so neither tool's migrations touch the other's tables.

---

## Requirements

- **Node 18+** and **Python 3.11+**
- **PostgreSQL 14+** with the **pgvector** extension
- **Ollama** (https://ollama.com) — runs the local LLMs
- ~**12 GB free RAM** to hold the models comfortably; a GPU makes voice/chat snappier (CPU works, slower)
- macOS or Linux (the setup script supports brew + apt)

## Quick start — one command

```bash
./scripts/setup.sh          # installs deps, sets up the DB + pgvector, pulls models, builds both apps
./scripts/dev.sh            # starts frontend (:3000) + backend (:8000)
```

Or do both at once: `./scripts/setup.sh --run`  ·  add `--voice` to also download the Kokoro
neural voice (~340 MB; otherwise voice uses the macOS `say` fallback).

Then open **http://localhost:3000** → **Log in** (the form is pre-filled with a demo account;
use **Register** to create your own with company + timezone) → **AI Receptionist**.

### What setup.sh does (idempotent — safe to re-run)
1. Checks/installs Node, Python, PostgreSQL, Ollama.
2. Creates `.env` from `.env.example` (review it).
3. Creates the `fieldflow` database + enables `pgvector`.
4. Pulls the Ollama models: `qwen2.5:3b` (chat), `qwen3.5:9b` (scoring/summaries), `phi3:3.8b`, `nomic-embed-text`.
5. Frontend: `npm install` + Prisma generate/push/seed.
6. Backend: Python venv + `pip install`.

## Manual setup (if you prefer)

```bash
createdb fieldflow && psql -d fieldflow -c "CREATE EXTENSION vector;"
cp .env.example .env            # set DATABASE_URL + SMTP_* (see below)
ollama pull qwen2.5:3b && ollama pull qwen3.5:9b && ollama pull phi3:3.8b && ollama pull nomic-embed-text

cd frontend && npm install && npm run setup && npm run dev          # :3000
cd backend  && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt \
            && .venv/bin/uvicorn app.main:app --reload --port 8000  # :8000/docs
```

The repo-root `.env` is shared by both services (frontend reads it via a `frontend/.env` symlink).

## Email (calendar invites)

Bookings email an `.ics` invite when SMTP is configured (otherwise it's download-only). Add to `.env`:

```ini
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com          # Gmail: create an App Password (needs 2FA)
SMTP_PASSWORD=your-app-password
SMTP_FROM=you@gmail.com
```

## Models (local, low-cost)

| Role | Model | Why |
|---|---|---|
| Customer chat | `qwen2.5:3b` | Fast (~3.5s warm), natural, reliable JSON |
| Lead scoring + summaries | `qwen3.5:9b` | Stronger reasoning (runs in the background) |
| Embeddings (RAG) | `nomic-embed-text` | 768-dim |
| Voice | **Kokoro** (local, female) | macOS `say` fallback until the model files are installed |

## Run with Docker (alternative)

```bash
docker compose up                      # Postgres+pgvector + backend + frontend (auto migrate+seed)
docker compose --profile ollama up     # also run Ollama in a container (heavy first-run pull)
```

## Production / cloud notes

- **Hosting the LLM is the only real cost.** A small CPU box runs `qwen2.5:3b` (a bit slower);
  a budget GPU (AWS Activate credits, RunPod, Lambda, Hetzner) makes chat + voice snappy.
- **Secrets:** put `JWT_SECRET`, `SMTP_PASSWORD`, `DATABASE_URL` in your host's secrets manager,
  not a committed file (`.env` is gitignored).
- **Scaling:** the FastAPI service is stateless (sessions live in Postgres) → run multiple replicas
  behind a load balancer; point them at one managed Postgres (Supabase/RDS) + one Ollama host
  (or an Ollama pool). Prisma `public` + FastAPI `techages` schemas keep migrations independent.
- **Same setup on the server:** `./scripts/setup.sh` works on Debian/Ubuntu (apt) too.

## Docs

`docs/` — `product_roadmap.md`, `research_findings.md`, `codebase_reference.md`.
`backend/README.md` — service + endpoint reference. `planing/` — strategy + competitive analysis.
