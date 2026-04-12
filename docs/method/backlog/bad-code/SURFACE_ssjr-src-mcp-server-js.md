---
id: SURFACE_ssjr-src-mcp-server
blocks: []
blocked_by:
  - SURFACE_audit-mcp-contract-holes
  - SURFACE_ssjr-src-mcp-service
  - SURFACE_ssjr-src-mcp-result
---

# Raise SSJR grades for `src/mcp/server.js`

Current SSJR sanity check: `Hex A`, `P1 C`, `P3 B`, `P6 C`, `P7 B`.

Boundary schemas are strong here, but command definitions are still spread across repeated schema/result wiring. Consolidate the MCP tool registry so names, schemas, and execution contracts derive from one runtime-backed command definition.
