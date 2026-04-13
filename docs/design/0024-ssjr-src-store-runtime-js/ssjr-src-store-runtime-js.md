---
title: "Raise SSJR grades for `src/store/runtime.js`"
legend: "CORE"
cycle: "0024-ssjr-src-store-runtime-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-store-runtime-js.md"
---

# Raise SSJR grades for `src/store/runtime.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-store-runtime-js.md`
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

Current SSJR sanity check: `Hex C`, `P1 D`, `P2 D`, `P3 C`, `P4 D`, `P5 B`, `P6 B`, `P7 D`.

This file is the core/runtime seam with the most architectural strain. It mixes graph access, host-specific opening, raw prop normalization, and `kind`-driven reconstruction of domain meaning. Break it up and introduce typed read models so the runtime seam stops leaking host details and shape soup into the store core.
