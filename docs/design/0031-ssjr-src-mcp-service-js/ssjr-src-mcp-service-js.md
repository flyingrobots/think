---
title: "Raise SSJR grades for `src/mcp/service.js`"
legend: "SURFACE"
cycle: "0031-ssjr-src-mcp-service-js"
source_backlog: "docs/method/backlog/bad-code/SURFACE_ssjr-src-mcp-service-js.md"
---

# Raise SSJR grades for `src/mcp/service.js`

Source backlog item: `docs/method/backlog/bad-code/SURFACE_ssjr-src-mcp-service-js.md`
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

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 B`, `P3 B`, `P4 B`, `P5 B`, `P6 B`, `P7 B`.

This is the exact shape-soup debt already called out in BEARING. The service layer mostly shuffles plain objects between boundaries and store calls; introduce runtime-backed request and result forms so the MCP surface owns fewer soft contracts.
