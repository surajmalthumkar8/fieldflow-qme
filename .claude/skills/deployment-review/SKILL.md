---
name: deployment-review
description: >
  Review the project's deployment strategy and infra-as-code for correctness, security,
  cost, and scaling readiness before a deploy or platform migration. Use to audit
  Dockerfiles, docker-compose, render.yaml/railway/fly configs, CI/CD, health checks,
  env wiring, and scale-up/down behavior. Produces a prioritized findings list with fixes.
---

# Deployment Review Skill

Audit how the system ships and runs, and return prioritized, fixable findings.

## Scope (read these)
- `*/Dockerfile`, `docker-compose*.yml`, `.dockerignore`
- Platform configs: `render.yaml`, `railway.*`, `fly.toml`, `vercel.json`, k8s manifests
- CI/CD workflows; build + start commands; migration/seed jobs
- Health checks, readiness/liveness gates, restart policies
- Env/secret wiring (names only — never print secret values)

## Checklist
**Correctness**
- Build context + root dir correct (e.g. monorepo: frontend/ vs backend/).
- Start command binds `0.0.0.0:$PORT`; migrations run before app serves traffic.
- Health/readiness endpoints wired so the LB drains on dependency failure.
- One-shot jobs (migrate/seed) actually exit; long-running workers actually stay up.

**Security**
- No secrets baked into images or compose defaults (`JWT_SECRET: change-me` etc.).
- Least-privilege DB creds; CORS scoped to real origins; TLS terminated.
- Base images pinned + minimal; non-root user; `.dockerignore` excludes secrets/`.env`.

**Cost**
- Image size + build minutes (multi-stage? slim base?).
- Always-on vs scale-to-zero; right-sized instances; no orphaned services.
- GPU presence (and whether it's justified vs. an API).

**Scaling (up AND down)**
- Horizontal scale story: is the app stateless? Where does shared state live?
- Concurrency ceilings (e.g. single-slot model serving, DB pool size).
- Cold-start behavior on scale-from-zero; autoscaling triggers + limits.
- What the bill does idle (does anything expensive fail to scale to zero?).

## Output format
A table ranked by severity, then a short "ship-blockers vs. nice-to-haves" summary.

| Severity | Area | Finding | Why it matters | Fix |
|----------|------|---------|----------------|-----|

Severity = Blocker / High / Medium / Low. Blockers must be fixed before deploy.

## Rules
- Distinguish a real ship-blocker from a polish item — don't cry wolf.
- For platform migrations, verify the target supports every component (e.g. confirm GPU
  availability before assuming a local-model service can move) using
  **documentation-research**.
- Provide the concrete fix (command, config snippet, or file change), not just the
  problem. For low-risk infra fixes, hand to the governance agent's Dangerous-Skip mode.
