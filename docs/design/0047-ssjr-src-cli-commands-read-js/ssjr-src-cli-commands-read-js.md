---
title: "Raise SSJR grades for `src/cli/commands/read.js`"
legend: "SURFACE"
cycle: "0047-ssjr-src-cli-commands-read-js"
source_backlog: "docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-commands-read-js.md"
---

# Raise SSJR grades for `src/cli/commands/read.js`

Source backlog item: `docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-commands-read-js.md`
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

Current SSJR sanity check: `Hex C`, `P1 C`, `P2 B`, `P3 D`, `P4 B`, `P5 B`, `P6 C`, `P7 D`.

This command surface is doing too much with too many raw result shapes. Split command-specific presentation into smaller owned modules and replace command/result switching with behavior that lives on the types or handlers that own it.
