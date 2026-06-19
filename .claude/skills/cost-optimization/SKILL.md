---
name: cost-optimization
description: >
  Continuously find ways to cut cloud and infrastructure spend. Use to run a cost sweep
  over the repo's infra definitions (Docker/compose, render.yaml/railway/fly configs, CI,
  env) and any available billing data to detect unused services, over-provisioned or
  idle resources, duplicate services, underutilized GPUs, idle databases, and excessive
  logging. Produces a ranked monthly-savings report.
---

# Cost Optimization Skill

Generate a **ranked monthly savings report** by hunting for waste in the current setup.

## What to look for
- **Unused services** — declared in compose/infra but never called; dead routes; orphaned
  workers; preview/staging envs left running.
- **Over-provisioned infra** — instance sizes larger than observed CPU/RAM use; always-on
  services that could scale to zero; multi-replica where one suffices.
- **Duplicate services** — two things doing the same job (e.g. a second Ollama host, two
  Postgres instances, redundant queues/caches).
- **Expensive cloud resources** — GPU instances, large managed DBs, NAT/egress, premium
  support tiers, per-seat plans with idle seats.
- **Underutilized GPUs** — a 24/7 GPU serving sporadic inference (the classic burn). Flag
  always-on GPU spend vs. serverless/API alternatives.
- **Unnecessary containers** — sidecars, one-shot jobs left as long-running, oversized
  base images inflating build minutes + cold starts.
- **Idle databases** — DBs with no recent connections; over-sized storage; unused read
  replicas.
- **Excessive logging / observability** — verbose log levels in prod, high-cardinality
  metrics, log retention longer than needed, full request/response body logging.

## Procedure
1. **Inventory.** Read every infra definition: `docker-compose*.yml`, `*/Dockerfile`,
   `render.yaml`, `railway.*`, `fly.toml`, CI workflows, `.env*` (names only — never echo
   secret values). List every declared service, its size/plan, and whether it is
   always-on.
2. **Cross-reference usage.** Where billing/metrics are available (this project meters AI
   usage in `usage_event`/`usage_period`), use them to separate "provisioned" from
   "actually used". Otherwise reason from the architecture and state the assumption.
3. **Price each item.** Pull current rates via the **documentation-research** skill so
   savings figures are real, not guessed.
4. **Compute savings.** For each finding: current $/mo → proposed $/mo → **monthly
   saving**.
5. **Rank.** Sort by a simple score and present a table.

## Output format
A table ranked by savings, plus a one-paragraph "do these first" summary.

| # | Finding | Current $/mo | After $/mo | Saving $/mo | Risk | Effort | Action |
|---|---------|-------------:|-----------:|------------:|------|--------|--------|

Each row: **Risk** = Low/Med/High (chance of breaking something), **Effort** =
Low/Med/High (work to implement). Recommend tackling **high-saving / low-risk /
low-effort** first; call those out explicitly.

## Rules
- Never recommend a cut that weakens security, removes backups, or risks data loss to
  save money — flag those as "do not cut".
- Always show the price source + date behind every dollar figure.
- Pair each cut with how to reverse it if it hurts.
- If a finding needs more than a config change, hand it to the governance agent for a
  full impact analysis + ADR rather than acting on it here.
