---
title: "Query layer repeatedly re-shapes the same entry data"
legend: "CORE"
cycle: "0022-audit-query-reshape-pipeline"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-query-reshape-pipeline.md"
---

# Query layer repeatedly re-shapes the same entry data

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-query-reshape-pipeline.md`
Legend: CORE

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

`src/store/queries.js` keeps remapping entries into new anonymous shapes for recent, remember, browse, inspect, and stats callers.

That increases coupling and makes it harder to trust that all surfaces are talking about the same domain object.
