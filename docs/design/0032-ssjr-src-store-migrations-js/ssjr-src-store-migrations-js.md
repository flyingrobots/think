---
title: "Raise SSJR grades for `src/store/migrations.js`"
legend: "CORE"
cycle: "0032-ssjr-src-store-migrations-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-store-migrations-js.md"
---

# Raise SSJR grades for `src/store/migrations.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-store-migrations-js.md`
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

Current SSJR sanity check: `Hex B`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P6 B`, `P7 D`.

The migration engine is graph-correct, but it reasons about node meaning almost entirely through raw props and `kind` checks. Introduce typed migration facts or per-kind migration helpers so the updater stops being a large conditional over graph shapes.
