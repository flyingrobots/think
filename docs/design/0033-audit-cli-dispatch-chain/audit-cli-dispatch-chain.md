---
title: "CLI dispatch is still a stringly `if/else` ladder"
legend: "SURFACE"
cycle: "0033-audit-cli-dispatch-chain"
source_backlog: "docs/method/backlog/bad-code/SURFACE_audit-cli-dispatch-chain.md"
---

# CLI dispatch is still a stringly `if/else` ladder

Source backlog item: `docs/method/backlog/bad-code/SURFACE_audit-cli-dispatch-chain.md`
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

The top-level CLI command path in `src/cli.js` is still an `if/else` dispatch chain keyed by strings.

It works, but it keeps command behavior, help identity, and reporting identity softer than they should be.
