---
title: "CLI parsing still depends on one large options bag"
legend: "SURFACE"
cycle: "0028-audit-cli-options-bag"
source_backlog: "docs/method/backlog/bad-code/SURFACE_audit-cli-options-bag.md"
---

# CLI parsing still depends on one large options bag

Source backlog item: `docs/method/backlog/bad-code/SURFACE_audit-cli-options-bag.md`
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

`src/cli/options.js` builds a large procedural options object and validates it later through command-specific conditionals.

The result is serviceable but structurally mushy. Parsing and validation should return a smaller, more explicit runtime-backed parsed-command form.
