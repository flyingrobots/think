---
id: SURFACE_audit-mcp-contract-holes
blocks:
  - SURFACE_ssjr-src-mcp-server
blocked_by: []
---

# MCP contracts still have `z.any()` holes

`src/mcp/server.js` still uses `z.any()` for important outputs like migration results, remember matches and scope, browse session context, and inspect entry payloads.

That weakens integration trust exactly where Think claims MCP parity with the CLI core.
