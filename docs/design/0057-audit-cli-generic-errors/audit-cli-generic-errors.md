---
title: "CLI still hides too much behind a generic top-level error"
legend: "SURFACE"
cycle: "0057-audit-cli-generic-errors"
source_backlog: "docs/method/backlog/bad-code/SURFACE_audit-cli-generic-errors.md"
---

# CLI still hides too much behind a generic top-level error

Source backlog item: `docs/method/backlog/bad-code/SURFACE_audit-cli-generic-errors.md`
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

`src/cli.js` catches unexpected failures and tells the default human path only `Something went wrong`.

That keeps output terse, but it also weakens self-serve recovery and makes production debugging slower than necessary.
