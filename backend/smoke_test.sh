#!/usr/bin/env bash
# Smoke-test the running FastAPI service (start it first: uvicorn app.main:app --port 8000).
# Exercises auth, chat, qualify, summarize, KB ingest/search, and voice end-to-end.
set -uo pipefail
BASE="${1:-http://localhost:8000}"
EMAIL="smoke+$$@techages.ai"
PASS="smoketest12345"
PY="$(dirname "$0")/.venv/bin/python"

j() { "$PY" -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',''))"; }

echo "1) health";     curl -sf "$BASE/health" >/dev/null && echo "   ok"
echo "2) register";   TOKEN=$(curl -sf -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
                          -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"role\":\"admin\"}" | j access_token)
[ -n "$TOKEN" ] && echo "   ok (token ${#TOKEN} chars)"
echo "3) me";         curl -sf "$BASE/auth/me" -H "Authorization: Bearer $TOKEN" >/dev/null && echo "   ok"
echo "4) chat";       curl -sf -X POST "$BASE/chat" -H 'Content-Type: application/json' \
                          -d '{"business_id":"smoke","business_name":"Demo Realty","message":"I want to buy in Austin, budget 600k"}' | j reply
echo "5) qualify";    curl -sf -X POST "$BASE/qualify" -H 'Content-Type: application/json' \
                          -d '{"history":[{"role":"user","content":"Buy 3BR Austin 650k, 2 months, pre-approved, Sam sam@x.com"}]}' | j leadGrade
echo "6) summarize";  curl -sf -X POST "$BASE/summarize" -H 'Content-Type: application/json' \
                          -d '{"history":[{"role":"user","content":"Buy 3BR Austin 650k, 2 months"}]}' | j summary
echo "7) kb ingest";  curl -sf -X POST "$BASE/kb/documents" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
                          -d '{"business_id":"smoke","title":"FAQ","content":"Demo Realty covers Austin. Commission is 2.5 percent."}' | j chunks
echo "8) kb search";  curl -sf -X POST "$BASE/kb/search" -H 'Content-Type: application/json' \
                          -d '{"business_id":"smoke","query":"commission?","top_k":1}' | "$PY" -c "import sys,json;print(json.load(sys.stdin)[0]['content'][:60])"
echo "9) voice";      curl -sf -X POST "$BASE/voice" -H 'Content-Type: application/json' -d '{"text":"Hello from Ava."}' -o /tmp/smoke_voice.wav \
                          && echo "   ok ($(wc -c </tmp/smoke_voice.wav) bytes wav)"
echo "Done."
