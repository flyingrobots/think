# Raise SSJR grades for `bin/think-mcp.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`.

This entrypoint is thin, but it still carries soft-contract glue. Keep it as a pure adapter shell, avoid re-declaring runtime contracts here, and make sure command/result shaping stays owned by the MCP modules beneath it.
