---
title: "MCP service layer still shuffles raw objects"
legend: "SURFACE"
cycle: "0026-audit-mcp-service-shape-soup"
source_backlog: "docs/method/backlog/bad-code/SURFACE_audit-mcp-service-shape-soup.md"
---

# MCP service layer still shuffles raw objects

Source backlog item: `docs/method/backlog/bad-code/SURFACE_audit-mcp-service-shape-soup.md`
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

`src/mcp/service.js` is already called out in `docs/BEARING.md` as shape-soup debt, and the audit agrees. It mostly normalizes inputs, calls store functions, and returns anonymous result bags.

That is acceptable for a tiny adapter, but this one is now large enough to deserve explicit request and result forms.
