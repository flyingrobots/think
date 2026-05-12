---
title: "Cross-surface failures still lack a typed error taxonomy"
legend: "CORE"
cycle: "0020-audit-no-error-taxonomy"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-no-error-taxonomy.md"
---

# Cross-surface failures still lack a typed error taxonomy

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-no-error-taxonomy.md`
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

CLI, MCP, and store paths still throw or translate many failures as raw `Error` objects or generic strings.

Think needs a smaller set of owned failure types so human and machine surfaces can report the same truth consistently.
