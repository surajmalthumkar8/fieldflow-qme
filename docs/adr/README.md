# Architecture Decision Records (ADRs)

This directory is the team's **durable memory** for significant architecture, infra,
cloud, AI-model, deployment, scaling, security, and cost decisions. The
[Architecture Governance Agent](../../.claude/agents/architecture-governance.md) writes one
for every consequential recommendation and reads them all before recommending anything
new, so decisions stay consistent over time.

## How it works
- One decision per file: `NNNN-short-title.md`, numbered in sequence.
- Start from [`0000-template.md`](0000-template.md).
- Status lifecycle: **Proposed → Accepted → (later) Superseded / Deprecated**.
- Never silently contradict an Accepted ADR — write a new one that **supersedes** it and
  link both ways.

## When to write one
A new feature, service, dependency, framework, architecture pattern, AI model, or
deployment/scaling/security/cost decision that is expensive to reverse or affects more
than one component.

## Index

| ADR | Title | Status | Date | Supersedes |
|-----|-------|--------|------|------------|
| [0001](0001-cloud-deployment-and-model-provider-strategy.md) | Cloud deployment + AI model-provider strategy | Proposed | 2026-06-19 | — |
| [0002](0002-frontend-hosting-and-topology.md) | Frontend hosting + app topology (startup cost-optimized) | Proposed | 2026-06-19 | builds on 0001 |

_Add a row here every time an ADR is created._
