---
title: "Raise SSJR grades for `src/store/queries.js`"
legend: "CORE"
cycle: "0030-ssjr-src-store-queries-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-store-queries-js.md"
---

# Raise SSJR grades for `src/store/queries.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-store-queries-js.md`
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

Current SSJR sanity check: `Hex C`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 C`.

The query layer reconstructs many domain records by hand and then re-shapes them again for callers. Move toward runtime-backed read models so query code returns trusted objects instead of repeatedly rebuilding loosely related plain-object views.
