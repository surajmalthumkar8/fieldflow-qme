# Architecture Governance System — Design

A standing, reusable system that keeps every architecture / infra / cloud / AI-model /
deployment / scaling / security / cost decision grounded in **current facts** and
**recorded** for consistency. This document is the blueprint; the working parts are the
agent + skills + ADR store listed below.

## Components (all live in this repo)

| Component | Path | What it is |
|-----------|------|------------|
| Architecture Governance Agent | [`.claude/agents/architecture-governance.md`](../.claude/agents/architecture-governance.md) | The reviewer subagent. Research-first, generates alternatives + cost/risk, writes ADRs. |
| Documentation Research Skill | [`.claude/skills/documentation-research/SKILL.md`](../.claude/skills/documentation-research/SKILL.md) | Pulls latest official docs/pricing/release notes. |
| Impact Analysis Skill | [`.claude/skills/impact-analysis/SKILL.md`](../.claude/skills/impact-analysis/SKILL.md) | Five-axis evaluation + alternatives. |
| Cost Optimization Skill | [`.claude/skills/cost-optimization/SKILL.md`](../.claude/skills/cost-optimization/SKILL.md) | Ranked monthly-savings sweep. |
| Deployment Review Skill | [`.claude/skills/deployment-review/SKILL.md`](../.claude/skills/deployment-review/SKILL.md) | Infra-as-code correctness/security/cost/scaling audit. |
| Canonical sources registry | [`docs/governance/sources.yaml`](governance/sources.yaml) | Official doc/pricing URLs per provider. |
| ADR store (memory) | [`docs/adr/`](adr/) | Durable decision records + index. |

## Agent architecture

```
                         ┌─────────────────────────────────────────┐
   developer proposal →  │     Architecture Governance Agent        │
   or audit request      │      (.claude/agents, Advisory default)  │
                         └───────────────┬─────────────────────────┘
                                         │ orchestrates
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                ▼                ▼                ▼                ▼
  documentation-    impact-analysis  cost-optimization deployment-review  (reads)
  research (facts)  (5 axes + alts)  (savings sweep)   (infra audit)      docs/adr/*
        │                │                │                │                │
        └── WebSearch ───┴── Read/Grep ───┴── Bash ────────┴── WebFetch ────┘
                                         │
                                         ▼
                        Cost Impact Report + Recommendation
                                         │
                                         ▼
                          writes ADR → docs/adr/NNNN-*.md
                              (updates docs/adr/README.md index)
```

The agent is the orchestrator; the four skills are reusable capabilities it (or a
developer) invokes. The ADR store is shared memory: read before deciding, written after.

## Prompt definitions
Full system prompt lives in the agent file. Its load-bearing rules:
- **Never recommend from memory** — research latest docs + pricing first; date every figure.
- **Ground in the real codebase** — read the actual Dockerfiles/compose/deps/config.
- **Advisory by default** — recommend, don't mutate, unless `mode: dangerous-skip`.
- **Be consistent** — read prior ADRs; supersede, never silently contradict.
- **Always quantify** — immediate / operational / engineering / scaling / hidden cost.
- **Required outputs** — Cost Impact Report + the 6-part Recommendation Format + an ADR.

Each skill's prompt is its `SKILL.md`. They are deliberately single-purpose so they compose.

## Tool definitions
| Tool | Used for |
|------|----------|
| `WebSearch` / `WebFetch` | Latest official docs, pricing, release notes, best practices. |
| `Read` / `Grep` / `Glob` | Understand current architecture, deps, config, infra-as-code. |
| `Bash` | Inspect the repo (image sizes, declared services, lockfiles) read-only. |
| `Write` / `Edit` | Create ADRs (always); apply low-risk infra changes only in Dangerous-Skip. |

## MCP integrations (optional, plug-in as the team adopts them)
The agent reaches any session-connected MCP tool via tool search. Useful additions:
- **Cloud billing MCP** (AWS/GCP/Azure cost APIs) → real spend instead of list price.
- **GitHub MCP / `gh`** → open a PR with a proposed `render.yaml` / config change + the ADR.
- **Atlassian / Slack MCP** → post the recommendation summary to the team channel.
- **Postman MCP** → validate provider API contracts when adding a new integration.
Until connected, the agent uses web research + the repo + the sources registry.

## Required workflows
1. **Proposal review** (developer proposes X): Understand → Impact Analysis → alternatives →
   Cost Impact Report → Recommendation → ADR (Proposed). Human accepts → status Accepted.
2. **One-time / periodic architecture audit**: deployment-review + cost-optimization across
   the whole repo → findings → ADRs for anything significant. (Run quarterly.)
3. **Monthly cost sweep**: cost-optimization skill → ranked savings table → act on
   high-saving/low-risk/low-effort; ADR for structural changes.
4. **Pre-deploy gate**: deployment-review before any deploy or platform migration; block on
   Blockers.

## Memory requirements
- **ADRs (`docs/adr/`)** are the durable memory — every significant decision, with cost +
  rationale, read before the next decision for consistency.
- **`sources.yaml`** is the research memory — canonical URLs so research is fast + official.
- **Usage metering** (`usage_event` / `usage_period`, already in the app) feeds real
  utilization into the cost-optimization skill (provisioned vs. actually used).
- Optional: a `docs/governance/cost-baseline.md` snapshot per month to trend spend.

## Example outputs
- A complete, real Cost Impact Report + Recommendation + ADR:
  [`docs/adr/0001-cloud-deployment-and-model-provider-strategy.md`](adr/0001-cloud-deployment-and-model-provider-strategy.md).
- Skill outputs follow the templates in each `SKILL.md` (ranked savings table; five-axis
  impact table; dated fact sheet; severity-ranked deployment findings).

## Recommended implementation approach (phased)
1. **Now (done):** agent + 4 skills + ADR store + sources registry committed to the repo.
   Run in **Advisory mode** only.
2. **Adopt in workflow:** invoke the agent on the next real proposal; require an ADR for any
   decision that's expensive to reverse. Add a PR checklist item: "Governance ADR linked?".
3. **Connect data:** wire a cloud-billing MCP + `gh` so cost numbers are real and the agent
   can open PRs with the proposed config change attached to the ADR.
4. **Automate sweeps:** schedule the monthly cost-optimization sweep and quarterly audit
   (e.g. via the `/schedule` routine) so governance is continuous, not ad-hoc.
5. **Graduate Dangerous-Skip:** only after the team trusts Advisory output, enable
   Dangerous-Skip for clearly low-risk infra/config edits (with the mandatory
   what-changes / impact / rollback preamble).
