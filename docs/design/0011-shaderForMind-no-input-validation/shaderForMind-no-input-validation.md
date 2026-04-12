---
title: "shaderForMind lacks input validation"
legend: "CORE"
cycle: "0011-shaderForMind-no-input-validation"
source_backlog: "docs/method/backlog/bad-code/CORE_shaderForMind-no-input-validation.md"
---

# shaderForMind lacks input validation

Source backlog item: `docs/method/backlog/bad-code/CORE_shaderForMind-no-input-validation.md`
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

`shaderForMind(name, shaderCount)` does not validate that
`shaderCount > 0`. If 0 or negative, `Math.abs(hash) % shaderCount`
produces `NaN` or `Infinity` silently.

File: `src/minds.js`
