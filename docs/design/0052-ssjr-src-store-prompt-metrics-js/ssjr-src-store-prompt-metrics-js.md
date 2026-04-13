---
title: "Raise SSJR grades for `src/store/prompt-metrics.js`"
legend: "CORE"
cycle: "0052-ssjr-src-store-prompt-metrics-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-store-prompt-metrics-js.md"
---

# Raise SSJR grades for `src/store/prompt-metrics.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-store-prompt-metrics-js.md`
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

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 C`, `P3 B`, `P4 C`, `P6 B`, `P7 B`.

Prompt metrics are handled as tolerant raw records, which is useful at the boundary but too loose in the core summarization path. Introduce an explicit parsed metric record form so invalid lines are rejected once and downstream aggregation deals in trusted values.
