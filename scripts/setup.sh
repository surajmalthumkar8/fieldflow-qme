#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Techaegis AI / FieldFlow — one-command setup.
# Idempotent: safe to re-run. Works on macOS (brew) and Debian/Ubuntu (apt).
#
#   ./scripts/setup.sh            # full setup (deps, DB, models, builds)
#   ./scripts/setup.sh --run      # ...then start both servers
#   ./scripts/setup.sh --voice    # ...also download the Kokoro neural-voice model (~340MB)
#
# Prereqs it installs/uses: Node 18+, Python 3.11+, PostgreSQL + pgvector, Ollama.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_AFTER=false
WITH_VOICE=false
for arg in "$@"; do
  case "$arg" in
    --run) RUN_AFTER=true ;;
    --voice) WITH_VOICE=true ;;
  esac
done

# Required Ollama models (current build). Just two, ~1.3GB total: one small fast
# chat model (lead grading is a heuristic now, so no big model is needed) and the
# embedding model for RAG.
MODELS=("qwen2.5:1.5b" "nomic-embed-text")
DB_NAME="fieldflow"

bold(){ printf "\n\033[1m▶ %s\033[0m\n" "$*"; }
ok(){ printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn(){ printf "  \033[33m!\033[0m %s\n" "$*"; }
die(){ printf "  \033[31m✗ %s\033[0m\n" "$*"; exit 1; }
have(){ command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"
if [ "$OS" = "Darwin" ]; then PKG="brew"; elif have apt-get; then PKG="apt"; else PKG="none"; fi

pkg_install(){ # pkg_install <brew-formula> <apt-package>
  case "$PKG" in
    brew) brew list "$1" >/dev/null 2>&1 || brew install "$1" ;;
    apt)  sudo apt-get update -qq && sudo apt-get install -y "$2" ;;
    *)    die "Install '$1' manually (no brew/apt found)." ;;
  esac
}

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
bold "1/6 · Checking prerequisites ($OS, pkg: $PKG)"

have node || { warn "Node not found — installing"; pkg_install node nodejs; }
have node && ok "Node $(node -v)"
have npm  || die "npm not found (install Node.js)."

have python3 || { warn "Python not found — installing"; pkg_install python@3.11 python3; }
ok "Python $(python3 -V 2>&1 | awk '{print $2}')"
python3 -m venv --help >/dev/null 2>&1 || pkg_install python@3.11 python3-venv

if ! have ollama; then
  warn "Ollama not found — installing"
  if [ "$OS" = "Darwin" ]; then brew install ollama || die "Install Ollama from https://ollama.com/download";
  else curl -fsSL https://ollama.com/install.sh | sh; fi
fi
ok "Ollama present"

if ! have psql; then
  warn "PostgreSQL not found — installing"
  if [ "$OS" = "Darwin" ]; then pkg_install postgresql@16 postgresql; brew services start postgresql@16 || true;
  else pkg_install postgresql postgresql; sudo service postgresql start || true; fi
fi
ok "PostgreSQL present"

# ── 2. Environment file ──────────────────────────────────────────────────────
bold "2/6 · Environment (.env)"
if [ ! -f .env ]; then
  cp .env.example .env
  # Default the DB URL to the current OS user on localhost.
  sed -i.bak "s#postgresql://USER@#postgresql://$(whoami)@#" .env && rm -f .env.bak
  ok "Created .env from .env.example (review SMTP_* + secrets before production)"
else
  ok ".env already present"
fi

# ── 3. Database + pgvector ───────────────────────────────────────────────────
bold "3/6 · Database '$DB_NAME' + pgvector"
# Wait for Postgres to accept connections.
for i in $(seq 1 15); do pg_isready -q && break; sleep 1; done
if psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  ok "Database '$DB_NAME' exists"
else
  createdb "$DB_NAME" && ok "Created database '$DB_NAME'"
fi
if psql -d "$DB_NAME" -tc "SELECT 1 FROM pg_available_extensions WHERE name='vector'" | grep -q 1; then
  psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null && ok "pgvector enabled"
else
  warn "pgvector not available for this Postgres. Install it:"
  warn "  macOS:  build from source (PG_CONFIG=\$(which pg_config) make install) in the pgvector repo"
  warn "  Ubuntu: sudo apt-get install postgresql-\$(pg_lsclusters -h | awk '{print \$1}')-pgvector"
fi

# ── 4. Ollama models ─────────────────────────────────────────────────────────
bold "4/6 · Ollama models"
(ollama list >/dev/null 2>&1) || { (ollama serve >/tmp/ollama.log 2>&1 &) ; sleep 3; }
for m in "${MODELS[@]}"; do
  if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$m"; then ok "$m present"
  else warn "pulling $m ..."; ollama pull "$m" && ok "$m pulled"; fi
done

# ── 5. Frontend (Next.js) ────────────────────────────────────────────────────
bold "5/6 · Frontend (frontend/)"
( cd frontend
  [ -d node_modules ] && ok "node_modules present" || { npm install && ok "npm install done"; }
  npm run setup >/dev/null 2>&1 && ok "Prisma generate + db push + seed done" || warn "prisma setup had warnings (check DATABASE_URL)"
)

# ── 6. Backend (FastAPI) ─────────────────────────────────────────────────────
bold "6/6 · Backend (backend/)"
( cd backend
  [ -d .venv ] || { python3 -m venv .venv && ok "created venv"; }
  .venv/bin/pip install -q --upgrade pip >/dev/null 2>&1
  .venv/bin/pip install -q -r requirements.txt && ok "Python deps installed"
  if $WITH_VOICE; then
    mkdir -p voices
    [ -f voices/kokoro-v1.0.onnx ] || { warn "downloading Kokoro voice (~340MB)";
      curl -fsSL -o voices/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
      curl -fsSL -o voices/voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
      ok "Kokoro voice installed"; }
  fi
)

bold "Setup complete ✅"
echo "  Run both services:   ./scripts/dev.sh"
echo "  Frontend:            http://localhost:3000   (log in → AI Receptionist)"
echo "  Backend API docs:    http://localhost:8000/docs"

if $RUN_AFTER; then bold "Starting services…"; exec ./scripts/dev.sh; fi
