---
title: "buildStatsSparkline duplicates logic from formatStats"
legend: "SURFACE"
cycle: "0012-buildStatsSparkline-duplication"
source_backlog: "docs/method/backlog/bad-code/SURFACE_buildStatsSparkline-duplication.md"
---

# buildStatsSparkline duplicates logic from formatStats

Source backlog item: `docs/method/backlog/bad-code/SURFACE_buildStatsSparkline-duplication.md`
Legend: SURFACE

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

## Hill

TBD

## Playback Questions

### Human

- [ ] TBD

### Agent

- [ ] TBD

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: TBD
- Non-visual or alternate-reading expectations: TBD

## Localization and Directionality

- Locale / wording / formatting assumptions: TBD
- Logical direction / layout assumptions: TBD

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: TBD
- What must be attributable, evidenced, or governed: TBD

## Non-goals

- [ ] TBD

## Backlog Context

Both `formatStats()` and `buildStatsSparkline()` in `src/mcp/format.js`
do the same `buckets.map(b => b.count).reverse()` → `sparkline()`.
`formatStats` does it inline AND `buildStatsSparkline` is exported for
`read.js`. Either inline everywhere or have `formatStats` call the
shared function — don't do both.

File: `src/mcp/format.js`
