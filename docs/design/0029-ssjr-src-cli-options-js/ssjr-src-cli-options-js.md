---
title: "Raise SSJR grades for `src/cli/options.js`"
legend: "SURFACE"
cycle: "0029-ssjr-src-cli-options-js"
source_backlog: "docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-options-js.md"
---

# Raise SSJR grades for `src/cli/options.js`

Source backlog item: `docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-options-js.md`
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

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 B`, `P3 C`, `P4 B`, `P6 C`, `P7 C`.

The parser currently produces a large mutable-feeling options bag and command resolution depends on stringly post-processing. Introduce explicit parsed-command and parsed-option forms so validation and dispatch stop depending on shape soup.
