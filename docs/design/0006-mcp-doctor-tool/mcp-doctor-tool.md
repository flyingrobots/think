---
title: "MCP doctor tool"
legend: "SURFACE"
cycle: "0006-mcp-doctor-tool"
source_backlog: "docs/method/backlog/v0.7.0/SURFACE_mcp-doctor-tool.md"
---

# MCP doctor tool

Source backlog item: `docs/method/backlog/v0.7.0/SURFACE_mcp-doctor-tool.md`
Legend: SURFACE

## Sponsors

- Human: James
- Agent: Claude

## Hill

The MCP `doctor` tool returns the same health checks as `--json --doctor`.

## Playback Questions

### Human

- [ ] Does the MCP tool list include `doctor`?

### Agent

- [ ] Does calling the MCP `doctor` tool return checks with status and message?

## Accessibility and Assistive Reading

- Not applicable — machine-readable MCP tool.

## Localization and Directionality

- Not applicable.

## Agent Inspectability and Explainability

- The tool returns structured checks — agents parse the status fields.

## Non-goals

- No new diagnostic checks (those are cycle 0007).

## Design

- Add `checkThinkHealth()` to `src/mcp/service.js` — calls `runDiagnostics`.
- Register `doctor` tool in `src/mcp/server.js` — no input, output is checks array.
- Add acceptance test in `test/acceptance/mcp.test.js`.
