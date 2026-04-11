---
title: "MCP doctor tool"
cycle: "0006-mcp-doctor-tool"
design_doc: "docs/design/0006-mcp-doctor-tool/mcp-doctor-tool.md"
outcome: hill-met
drift_check: yes
---

# MCP doctor tool Retro

## Summary

Wired `runDiagnostics` into the MCP server as a `doctor` tool.
Three files changed: service.js (checkThinkHealth), server.js
(tool registration with Zod schema), mcp.test.js (tool list + call).

## Playback Witness

- [verification.md](witness/verification.md) — 166 pass, 0 fail.

## Drift

- None.

## New Debt

- None.

## Cool Ideas

- None.

## Backlog Maintenance

- [x] Inbox processed
- [x] Priorities reviewed
- [x] Dead work buried or merged
