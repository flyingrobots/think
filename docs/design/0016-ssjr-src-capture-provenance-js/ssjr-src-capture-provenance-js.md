---
title: "Raise SSJR grades for `src/capture-provenance.js`"
legend: "CORE"
cycle: "0016-ssjr-src-capture-provenance-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-capture-provenance-js.md"
---

# Raise SSJR grades for `src/capture-provenance.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-capture-provenance-js.md`
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

Current SSJR sanity check: `Hex B`, `P1 B`, `P3 B`, `P6 B`.

The boundary normalization is disciplined, but provenance is still just a plain object. Introduce a small runtime-backed provenance form so the invariant lives on the value instead of in helper conventions spread across callers.
