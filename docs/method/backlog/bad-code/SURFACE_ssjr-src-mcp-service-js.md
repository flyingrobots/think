---
id: SURFACE_ssjr-src-mcp-service
blocks:
  - SURFACE_ssjr-src-mcp-result
  - SURFACE_ssjr-src-mcp-server
blocked_by:
  - SURFACE_audit-mcp-service-shape-soup
---

# Raise SSJR grades for `src/mcp/service.js`

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 B`, `P3 B`, `P4 B`, `P5 B`, `P6 B`, `P7 B`.

This is the exact shape-soup debt already called out in BEARING. The service layer mostly shuffles plain objects between boundaries and store calls; introduce runtime-backed request and result forms so the MCP surface owns fewer soft contracts.
