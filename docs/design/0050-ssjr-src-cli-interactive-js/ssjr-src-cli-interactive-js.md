---
title: "Raise SSJR grades for `src/cli/interactive.js`"
legend: "SURFACE"
cycle: "0050-ssjr-src-cli-interactive-js"
source_backlog: "docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-interactive-js.md"
---

# Raise SSJR grades for `src/cli/interactive.js`

Source backlog item: `docs/method/backlog/bad-code/SURFACE_ssjr-src-cli-interactive-js.md`
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

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`, `P7 B`.

The interactive shell helpers are structurally fine, but they still pass around a lot of loose prompt/render state. Keep the host concerns here, while moving reusable interaction semantics into runtime-backed forms where they matter.
