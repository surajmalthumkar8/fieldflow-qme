---
name: documentation-research
description: >
  Retrieve the LATEST official documentation, pricing, release notes, and best practices
  for a framework, cloud platform, or AI provider before any architecture or cost
  decision. Use whenever a recommendation depends on current facts (pricing, model names,
  limits, deprecations) — never answer those from memory. Returns dated, cited findings.
---

# Documentation Research Skill

Produce a **current, cited** fact sheet for one or more technologies so downstream
decisions are never made on stale assumptions.

## When to use
- Before recommending or comparing any provider/framework/model.
- Whenever the question involves pricing, rate limits, model lineup, region
  availability, deprecations, or "is X still the best way to do Y".
- To refresh a figure quoted in an ADR that is older than ~60 days.

## Procedure
1. **Look up canonical sources.** Read `docs/governance/sources.yaml`. If the technology
   isn't listed, add it (official domain only) as part of this run.
2. **Fetch the official page first.** Use `WebFetch` on the provider's own docs/pricing/
   changelog URL. Extract: current pricing tiers, free-tier limits, model names + context
   windows + token prices, hard limits (timeouts, payload, concurrency), and any
   deprecation/EOL notices.
3. **Cross-check pricing.** Confirm each price against at least one independent source
   (`WebSearch`). If they disagree, quote the official number and flag the discrepancy.
4. **Capture release notes.** Note anything shipped recently that changes the decision
   (new tier, new model, new region, removed free tier, raised limits).
5. **Stamp dates.** Every figure gets the date you retrieved it. Mark anything you could
   not verify as `UNVERIFIED (date)`.

## Output format
```
## <Technology> — researched <YYYY-MM-DD>
- Pricing: <tiers + rates, itemized>            [source]
- Free tier: <limits / spin-down / expiry>      [source]
- Models / SKUs: <names, context, $/unit>       [source]
- Hard limits: <timeouts, concurrency, payload> [source]
- Recent changes: <release notes that matter>   [source]
- Gotchas: <egress, lock-in, GPU absence, etc.>
Sources: <dated markdown links>
```

## Rules
- Official domain beats third-party blog. A blog is only acceptable as the *secondary*
  cross-check, never the primary price source.
- Prices move monthly — if you cannot fetch a live figure, say so; do not guess.
- Keep it to facts. Interpretation belongs in impact-analysis / the governance agent.
