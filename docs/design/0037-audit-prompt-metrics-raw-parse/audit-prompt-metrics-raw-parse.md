---
title: "Prompt metrics parsing is still a raw JSONL pipeline"
legend: "CORE"
cycle: "0037-audit-prompt-metrics-raw-parse"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-prompt-metrics-raw-parse.md"
---

# Prompt metrics parsing is still a raw JSONL pipeline

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-prompt-metrics-raw-parse.md`
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

`src/store/prompt-metrics.js` reads the whole file, parses line-by-line into anonymous objects, and lets downstream aggregation assume shape.

The failure mode is lenient, but the core contract stays soft and memory behavior will only get worse as the metrics file grows.
