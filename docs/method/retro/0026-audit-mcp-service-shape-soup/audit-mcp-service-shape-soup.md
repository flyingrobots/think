---
title: "MCP service shape soup"
cycle: "0026-audit-mcp-service-shape-soup"
outcome: hill-met
drift_check: yes
---

# MCP service shape soup Retro

## Summary

Merged duplicate toBrowseEntry/toRecentEntry into frozen toMcpEntry.
Same entry shape for browse and recent MCP results.

## Drift

- None.

## New Debt

- Other service returns still unfrozen. Low priority — they're
  consumed by the MCP server immediately.
