# ADR-NNNN: <Title>

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX | Deprecated
- **Date:** YYYY-MM-DD
- **Decision owner:** <name>
- **Supersedes / Superseded by:** <ADR link or —>

## Problem
What decision are we making and why now? One short paragraph.

## Context
Current architecture, costs, dependencies, and bottlenecks relevant to this decision.
Reference the real files. State any constraints (budget, privacy, latency, team size).

## Alternatives considered
For each option: what it changes + headline trade. Always ≥3 + a hybrid.

1. **<Option A>** — pros / cons
2. **<Option B>** — pros / cons
3. **<Option C>** — pros / cons
4. **Hybrid** — pros / cons

## Decision
The chosen option and the deciding trade-off. Be specific and actionable.

## Cost implications
| | Monthly | Annual |
|---|--------:|-------:|
| Fixed infra | | |
| Variable (per-use) | | |
| **Total (at stated load)** | | |

- **Operational cost:** maintenance/on-call burden.
- **Engineering cost:** migration effort + complexity.
- **Scaling cost:** what the bill + architecture do at 10× / 100×.
- **Hidden costs:** egress, cold starts, lock-in, per-seat, GPU idle, log volume.

## Risk analysis
| Risk | Likelihood | Blast radius | Mitigation |
|------|-----------|--------------|------------|

## Migration difficulty
Low | Medium | High — and why.

## Future implications
What this enables or forecloses. What would trigger revisiting this ADR.

## Sources
Dated links to the official docs/pricing used.
