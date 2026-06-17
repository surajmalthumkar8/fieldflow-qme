# Techages AI — FastAPI AI/Voice Microservice

The Python service that powers the real-estate AI receptionist: local-LLM chat,
lead qualification/scoring, conversation summaries, a per-business RAG knowledge
base, and female-voice TTS. It runs **alongside** the Next.js app (which keeps the
UI + CRUD) and is called over HTTP.

## Stack

- **FastAPI + Uvicorn** (async)
- **PostgreSQL + pgvector** — auth/session tables + RAG vectors (same `fieldflow` DB Prisma uses)
- **Ollama** (local) — `qwen3.5:9b` (receptionist + qualify), `mistral-nemo:12b` (summaries), `phi3:3.8b` (fast classify), `nomic-embed-text` (embeddings)
- **JWT auth** (python-jose) + bcrypt (passlib)
- **TTS** — Kokoro (target) with a macOS `say` (Samantha) fallback that works out of the box

## Prerequisites

- PostgreSQL running locally with the `fieldflow` database and pgvector enabled
  (`createdb fieldflow`, then `CREATE EXTENSION vector;`).
- Ollama running (`ollama serve`) with the models above pulled.
- `DATABASE_URL` set in the repo-root `.env` (the service reads it and forces the
  asyncpg driver automatically).

## Run

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Then open <http://localhost:8000/docs> for interactive API docs.
On startup the service auto-creates its tables (`app_user`, `app_session`,
`kb_document`, `kb_chunk`) and the pgvector index — no migration step.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | – | DB + Ollama + TTS status |
| POST | `/auth/register` `/auth/login` | – | issue JWT + create session |
| GET | `/auth/me` · POST `/auth/logout` | ✓ | current user · revoke sessions |
| POST | `/chat` | – | one receptionist turn (RAG-grounded) → reply + action + captured fields |
| POST | `/qualify` | – | score a transcript → grade (HOT/WARM/COLD) + lead/intent score + budget + opportunity |
| POST | `/summarize` | – | transcript → summary + next step + key facts |
| POST | `/kb/documents` | ✓ | ingest a KB doc (chunk + embed + store) |
| GET | `/kb/documents` | ✓ | list a business's KB docs |
| POST | `/kb/search` | – | vector search the KB |
| GET | `/voice/status` · POST `/voice` | – | TTS provider · text → WAV (female voice) |

## Configuration

Env vars (all optional; sensible local defaults):
`DATABASE_URL`, `OLLAMA_HOST`, `JWT_SECRET` (set a strong value in prod),
`ACCESS_TOKEN_MINUTES`, `TTS_PROVIDER` (`auto`|`kokoro`|`say`), `TTS_VOICE`,
`SAY_VOICE`, `CORS_ORIGINS`.

## Upgrading to Kokoro voice

The `say` fallback works immediately on macOS. For the production-quality local
female voice, install Kokoro and drop the model files into `backend/voices/`:

```bash
.venv/bin/pip install kokoro-onnx soundfile
# download kokoro-v1.0.onnx + voices-v1.0.bin into backend/voices/
```

The service auto-detects them and switches `tts_provider` to `kokoro`.
