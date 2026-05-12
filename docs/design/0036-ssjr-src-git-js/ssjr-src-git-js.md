---
title: "Raise SSJR grades for `src/git.js`"
legend: "CORE"
cycle: "0036-ssjr-src-git-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-git-js.md"
---

# Raise SSJR grades for `src/git.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-git-js.md`
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

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`, `P7 B`.

This adapter is in the right layer, but push/init outcomes and retry semantics are still mostly plain-object conventions. Introduce a few explicit runtime-backed outcomes or error types so callers stop interpreting raw shell results directly.
