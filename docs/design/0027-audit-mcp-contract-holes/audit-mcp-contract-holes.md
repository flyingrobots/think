---
title: "MCP contracts still have `z.any()` holes"
legend: "SURFACE"
cycle: "0027-audit-mcp-contract-holes"
source_backlog: "docs/method/backlog/bad-code/SURFACE_audit-mcp-contract-holes.md"
---

# MCP contracts still have `z.any()` holes

Source backlog item: `docs/method/backlog/bad-code/SURFACE_audit-mcp-contract-holes.md`
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

`src/mcp/server.js` still uses `z.any()` for important outputs like migration results, remember matches and scope, browse session context, and inspect entry payloads.

That weakens integration trust exactly where Think claims MCP parity with the CLI core.
