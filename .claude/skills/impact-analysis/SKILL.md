---
name: impact-analysis
description: >
  Structured five-axis evaluation of a proposed change before it ships. Use when a
  developer proposes a new feature, service, dependency, framework, architecture pattern,
  AI model, or deployment strategy and you need to weigh Cost, Performance, Reliability,
  Security, and Maintenance impact, then generate alternatives. Produces the input to an
  ADR.
---

# Impact Analysis Skill

Evaluate one proposed change across five axes, with current facts, and return at least
three alternatives plus a hybrid.

## Step 1 — Understand the baseline
Read the real system before judging the change:
- Current architecture (services, data stores, model routing, deploy targets).
- Existing cost (what's provisioned + running).
- Existing dependencies (`requirements.txt`, `package.json`, base images, lockfiles).
- Existing bottlenecks (single-slot model serving, sync chains, cold starts, N+1).

## Step 2 — Evaluate across five axes
For the proposal, assess each axis as **better / neutral / worse vs. baseline**, with a
one-line reason and any number:

- **Cost** — immediate $/mo delta, and at 10× / 100× load.
- **Performance** — latency, throughput, cold-start, concurrency ceiling.
- **Reliability** — failure modes, blast radius, single points of failure, recovery.
- **Security** — new attack surface, secrets/keys, data residency, authz changes
  (cross-check OWASP Top 10 / OWASP LLM Top 10 where relevant).
- **Maintenance** — ops burden, on-call surface, upgrade treadmill, vendor lock-in.

## Step 3 — Generate alternatives
Always produce **≥3 credible alternatives + 1 hybrid**. For each, state what it changes
and the headline trade. Use current pricing (via **documentation-research**) so the
comparison is real.

## Output format
```
### Proposal: <one line>
Baseline: <current state in one line>

| Axis        | vs baseline | Note (with numbers) |
|-------------|-------------|---------------------|
| Cost        | ↑/→/↓       | ...                 |
| Performance | ↑/→/↓       | ...                 |
| Reliability | ↑/→/↓       | ...                 |
| Security    | ↑/→/↓       | ...                 |
| Maintenance | ↑/→/↓       | ...                 |

Alternatives:
1. <name> — changes X; pro / con.
2. <name> — ...
3. <name> — ...
4. Hybrid — ...

Verdict: <one-line recommendation + the deciding axis>
```

## Rules
- Quantify wherever a number exists; mark guesses as estimates.
- Name the single deciding axis — most decisions hinge on one.
- Hand the verdict to the governance agent to produce the Cost Impact Report + ADR.
