# ADR-0002: Frontend hosting + app topology (startup cost-optimized)

- **Status:** Proposed
- **Date:** 2026-06-19
- **Decision owner:** Shiva Dey
- **Supersedes / Superseded by:** builds on [ADR-0001](0001-cloud-deployment-and-model-provider-strategy.md)

## Problem
As a bootstrapped startup we want the cheapest production hosting that doesn't waste
engineering time. Two approaches were proposed: (A) split — Next.js frontend on **Vercel**,
FastAPI + Postgres on **Render**; (B) **remove Next.js entirely** and serve the UI as
HTML/API templates from FastAPI. Which is best for cost, and what does it actually cost?

## Context
- We already have a **substantial, built Next.js/React app**: admin / agent / customer
  portals, recharts dashboards, real-time messaging UI, skeleton loaders, auth middleware.
  This UI *is* the product for a receptionist SaaS.
- Backend is FastAPI in Docker; data is Postgres+pgvector. ADR-0001 already moves inference
  off GPU to an API, so no GPU host is needed.
- Verified pricing (2026-06-19): **Vercel Hobby is non-commercial only** — a revenue SaaS
  must use **Pro at $20/member/mo**; **Render web services are $7/mo** (Node *or* Python),
  Render Postgres ~$7/mo; a **VPS + Coolify** self-host runs $4–6/mo.
- Startup reality: **engineering time is the scarcest resource**, not $7–20/mo of infra.

## Alternatives considered

1. **(Proposed A) Vercel (Next.js) + Render (FastAPI + Postgres).**
   - Pros: best-in-class frontend DX, preview deploys, edge.
   - Cons: **Vercel Pro $20/mo is mandatory** (commercial); **two vendors**, two dashboards,
     two pipelines, cross-origin proxy/CORS surface; Vercel usage can overshoot the $20
     credit. Edge perks don't matter for a B2B dashboard. **~$34/mo.**

2. **(Proposed B) Drop Next.js; FastAPI serves HTML/API templates (Jinja2).**
   - Pros: fewest services — one web service + DB; cheapest *infra* (~$14/mo).
   - Cons: **throws away the entire built React app**; weeks of rebuild; ships a *worse*,
     less-interactive product (no SPA, no client charts/real-time UX). Saves ~$7/mo infra
     while spending weeks of the most expensive resource. **Worst ROI.**

3. **(Chosen) Everything on Render — Next.js + FastAPI + Postgres.**
   - Pros: **keeps the full built UI**; **one vendor / one bill**; internal private
     networking (no CORS/proxy pain); cheaper than A (no $20 Vercel seat); pre-launch can
     use a free DB to drop further. **~$21/mo prod (~$14/mo pre-launch).**
   - Cons: no Vercel edge/preview niceties (not needed at this stage).

4. **(Hybrid / bootstrap extreme) Single VPS + Coolify**, both apps in Docker + Postgres on
   the box.
   - Pros: cheapest all-in (~$5–15/mo); Coolify gives git-push deploys + SSL.
   - Cons: you own ops — backups, patching, scaling, uptime. Trades dollars for your time.

## Decision
Adopt **Option 3 — host the whole stack on Render**: the existing Next.js app as a Node web
service, FastAPI as a Python web service, Render Postgres, with the model provider swapped
to an API per ADR-0001. Keep **Option 4 (VPS + Coolify)** as the fallback if we want to
shave to single-digit dollars and are willing to run ops.

Deciding trade-off: Option 3 is the only one that is simultaneously **cheap, keeps the
product we already built, and avoids multi-vendor complexity**. Approach A pays $13–20/mo
extra for edge features a B2B dashboard doesn't use; Approach B "saves" ~$7/mo but burns
weeks rebuilding UI we already have into a worse product — the opposite of saving money for
a startup whose scarce resource is time.

## Cost implications
| | Monthly | Annual |
|---|--------:|-------:|
| Frontend (Next.js, Render Starter) | $7 | $84 |
| Backend (FastAPI, Render Starter) | $7 | $84 |
| Postgres (Render Basic; free pre-launch) | $0–7 | $0–84 |
| **Fixed total** | **$14–21** | **$168–252** |
| Variable: Claude/OpenAI tokens (ADR-0001) | ~$20–500 by load | scales w/ traffic |

For comparison: **Approach A ≈ $34/mo ($408/yr)** fixed; **Approach B ≈ $14/mo infra but
+ weeks of rebuild** (thousands in eng time) and a weaker product; **VPS+Coolify ≈ $5–15/mo**
plus your ops time.

- **Operational cost:** Low — one Render dashboard, three managed services, internal
  networking. (VPS option: Medium — you run it.)
- **Engineering cost:** **~Zero for Option 3** (deploy what exists). Approach B: High (rewrite).
- **Scaling cost:** Idle → fixed $14–21 (inference → $0 per ADR-0001). Up → linear tokens +
  Render Standard autoscale; no Ollama single-slot ceiling.
- **Hidden costs:** Render egress beyond plan; Render per-seat ($19/user) only if team
  features needed; A also carries Vercel overage risk + CORS maintenance.

## Risk analysis
| Risk | Likelihood | Blast radius | Mitigation |
|------|-----------|--------------|------------|
| Outgrow Render frontend perf | Low | UX | Bump to Standard; revisit Vercel only if edge genuinely needed |
| Free pre-launch DB pauses/expires | Med | Data/UX | Move to paid Basic at launch (don't ship prod on free) |
| Want preview deploys later | Low | DX | Add Coolify previews, or reconsider Vercel for frontend only |

## Migration difficulty
**Low.** Option 3 deploys the existing apps as-is (plus ADR-0001's provider swap). No UI
rewrite. (Approach B would be **High** — full frontend rewrite.)

## Future implications
- Single-vendor Render keeps ops trivial while small; the Docker-based setup stays portable
  (can lift to Fly/VPS/Vercel later without lock-in).
- Revisit if: frontend traffic genuinely needs edge/CDN at the front (then Vercel for the
  frontend only), or if steady scale makes a VPS materially cheaper.

## Sources
- [Vercel Fair Use Guidelines (Hobby = non-commercial)](https://vercel.com/docs/limits/fair-use-guidelines) · [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Render vs Vercel](https://render.com/docs/render-vs-vercel-comparison) · [Render Pricing](https://render.com/pricing)
- [Self-host Next.js w/ Coolify on a VPS](https://www.devmorph.dev/blogs/stop-paying-vercel-tax-self-host-nextjs-coolify-vps)
- Repo (verified 2026-06-19): `frontend/Dockerfile`, `backend/Dockerfile`, `docker-compose.yml`
