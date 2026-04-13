---
title: "Raise SSJR grades for `src/cli.js`"
legend: "SURFACE"
cycle: "0038-ssjr-src-cli-js"
source_backlog: "docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-js.md"
---

# Raise SSJR grades for `src/cli.js`

Source backlog item: `docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-js.md`
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

Current SSJR sanity check: `Hex B`, `P1 B`, `P2 B`, `P3 C`, `P4 B`, `P6 B`, `P7 C`.

The top-level dispatcher still routes through command strings and a long conditional chain. Move toward command objects or a command registry that owns behavior so the CLI shell becomes thinner and less tag-oriented.
