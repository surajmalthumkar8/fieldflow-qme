# Changelog

Notable changes to Techaegis AI (the real-estate AI-receptionist platform), newest first.

---

## 2026-06-19 — Campaigns, SMS scaffolding, Architecture Governance, Docker fixes

A large session covering a new Campaigns feature, Twilio SMS groundwork, a reusable
Architecture Governance system, and the fixes needed to build/run the whole stack in
Docker.

### ✨ New feature: Campaigns & Offers
Company admins can run limited-time offers/promotions. The AI receptionist advertises
live offers to customers, staff are notified, and interested customers route to an agent.

- **Backend**
  - Models: `Campaign` + `CampaignInterest` — [backend/app/models/campaign.py](../backend/app/models/campaign.py)
    (title, offer, description, audience `customers|agents|both`, status `draft|active|ended`,
    optional `starts_at`/`ends_at` limited-time window).
  - Service `live_campaigns()` / `is_live()` / `format_for_prompt()` — single source of
    truth for "what's running now" — [backend/app/services/campaigns.py](../backend/app/services/campaigns.py).
  - Router — [backend/app/routers/campaigns.py](../backend/app/routers/campaigns.py):
    - `POST /campaigns`, `GET /campaigns`, `PATCH /campaigns/{id}` (launch via `status=active`,
      stop via `status=ended`), `DELETE /campaigns/{id}` — **admin-only, scoped by JWT**.
    - `GET /campaigns/active` — live offers for the signed-in user, filtered by role/audience.
    - `POST /campaigns/{id}/interest` — customer registers interest (deduped) + pings staff.
    - `GET /campaigns/{id}/interests` — admin/agent follow-up list.
  - Launch + interest **notifications** reuse the SMTP email path (best-effort, capped).
- **AI receptionist awareness** — live customer-facing offers are injected into Elara's
  prompt: [persona.yaml](../backend/app/prompts/persona.yaml) `campaigns_template`,
  [loader.py](../backend/app/prompts/loader.py) `active_campaigns` param, wired in
  [chat.py](../backend/app/routers/chat.py). The model is told to mention at most one,
  only when relevant, and never invent terms.
- **Frontend**
  - Admin page [/admin/campaigns](../frontend/app/(app)/admin/campaigns/page.tsx) — create
    offers, set a limited-time end, Launch/End, view who's interested.
  - Customer [ActiveOffers](../frontend/components/receptionist/ActiveOffers.tsx) card on
    **My Agent** with an "I'm interested" button.
  - 5 auth-forwarding proxies under [frontend/app/api/campaigns/](../frontend/app/api/campaigns/).
  - Nav entry (Workspace group) in [lib/nav.ts](../frontend/lib/nav.ts) + route gated in
    [middleware.ts](../frontend/middleware.ts).

### 📱 SMS / Twilio integration (scaffolding — disabled until creds set)
- Config fields + `sms_enabled` property — [config.py](../backend/app/core/config.py)
  (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` or
  `TWILIO_FROM_NUMBER`).
- Send service — [backend/app/services/sms.py](../backend/app/services/sms.py): async-safe
  wrapper over Twilio's sync SDK, auto-appends the **"Reply STOP to opt out."** footer,
  best-effort (returns `None`/error instead of raising).
- Router — [backend/app/routers/sms.py](../backend/app/routers/sms.py): `GET /sms/status`,
  `POST /sms/test` (admin-only test send).
- `twilio>=9.0` added to [requirements.txt](../backend/requirements.txt); env placeholders
  in `.env` + [.env.example](../.env.example); Twilio + SMTP vars passed through to the
  Docker backend in [docker-compose.yml](../docker-compose.yml).
- **Status:** credentials validated against Twilio (trial account → can only text
  *verified* numbers). Not yet wired into campaign/reactivation *sending* — see Pending.

### 🔒 Security hardening (earlier in the session)
- Closed 7 auth/scoping gaps: every data endpoint now derives `business_id`/`user_id` from
  the **JWT**, never the request body; Next.js proxies forward `Authorization: Bearer`.
- `FeedbackIn.business_id` made optional (server-derived) to fix a 422.
- Verified: unauthenticated → 401, customer → own rows only, public register → `customer`.

### 🧭 Architecture Governance system (reusable)
A standing system to keep architecture/cloud/cost decisions grounded in current docs and
recorded for consistency.
- Agent — [.claude/agents/architecture-governance.md](../.claude/agents/architecture-governance.md)
  (research-first, generates alternatives + cost/risk, writes ADRs; Advisory by default).
- Skills — `documentation-research`, `impact-analysis`, `cost-optimization`,
  `deployment-review` under [.claude/skills/](../.claude/skills/).
- Canonical sources registry — [docs/governance/sources.yaml](governance/sources.yaml).
- ADR store — [docs/adr/](adr/): **0001** (cloud deployment + AI model-provider strategy),
  **0002** (frontend hosting topology). Master design — [docs/architecture-governance.md](architecture-governance.md).
- Hybrid migration plan (Vercel + Render + Supabase + external model APIs + HF embeddings)
  — [docs/governance/hybrid-migration-plan.md](governance/hybrid-migration-plan.md).

### 🐳 Docker / production-build fixes
The stack now builds and runs end-to-end with `docker compose up -d --build`. Root cause:
a production `next build` runs with **no `DATABASE_URL`** at build time, and code was
hitting the DB during the build.
- **Lazy Prisma client** — [frontend/lib/db.ts](../frontend/lib/db.ts): construct on first
  use (request time) via a Proxy, and never pass `url: undefined`. Fixes the page-data
  collection crash.
- **`/login`** — [login/page.tsx](../frontend/app/login/page.tsx): wrapped `useSearchParams()`
  in `Suspense` (required for prerender).
- **`(app)` layout** — [layout.tsx](../frontend/app/(app)/layout.tsx): `export const dynamic
  = "force-dynamic"` so authenticated pages render per-request instead of being prerendered
  against a non-existent DB.
- Removed two stray committed vim `.swp` files.

### 🌱 Seed & data
- The registration dropdown only lists `trade: "real_estate"` companies, but the seed had
  none → "No companies available". Added two real-estate tenants and a `markets` field —
  [frontend/prisma/seed.ts](../frontend/prisma/seed.ts):
  - **Lone Star Realty** (markets `US`, Austin TX)
  - **Mumbai Premier Properties** (markets `IN`, Mumbai)
  - Demo transcripts made real-estate-aware.

### How to run (Docker)
```bash
docker compose up -d --build       # build + start db, backend (:8000), frontend (:3000)
docker compose ps                  # backend+frontend healthy; migrate exited(0) = one-shot OK
docker compose logs -f             # stream logs
```
Open http://localhost:3000. The Docker stack uses its **own** seeded Postgres (volume
`pgdata`), separate from local Postgres. `docker compose down` keeps data; `down -v` wipes it.

### Adding users (Docker DB)
Customers self-**Register** in the UI. For privileged roles, promote with SQL:
```bash
docker exec fieldflow-qme-db-1 psql -U fieldflow -d fieldflow -c \
  "UPDATE techaegis.app_user SET role='super_admin', business_id=NULL, company_name='' WHERE email='you@example.com';"
```
(`super_admin` = no company / `business_id=NULL`; roles are `super_admin|admin|agent|customer`.)

### Pending / next steps
- Wire `sms.send_sms` into campaign/reactivation **launch** (needs recipient phones +
  consent gate + STOP webhook). Trial Twilio only texts verified numbers.
- Execute the hybrid cloud migration (see ADR-0003 to be written) when ready.
