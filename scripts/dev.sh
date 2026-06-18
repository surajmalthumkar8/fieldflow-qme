#!/usr/bin/env bash
# Run the full Techages AI stack locally: Next.js (UI + CRUD) + FastAPI (AI/voice).
# Requires: Postgres (fieldflow DB + pgvector), Ollama running with the models pulled.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- FastAPI AI/voice service ---
if [ ! -d backend/.venv ]; then
  echo "Creating backend venv..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi

echo "Starting FastAPI on :8000 ..."
( cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000 ) &
API_PID=$!

# --- Next.js app (frontend/) ---
echo "Starting Next.js on :3000 ..."
( cd frontend && npm run dev ) &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' EXIT INT TERM
echo "Up: web http://localhost:3000  ·  api http://localhost:8000/docs"
wait
