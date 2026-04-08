# Use bijou-mcp for rich structured output in Think's MCP server

Bijou 4.2.0 ships `@flyingrobots/bijou-mcp` — 22 rendering tools (`bijou_table`, `bijou_tree`, `bijou_dag`, `bijou_box`, `bijou_inspector`, `bijou_accordion`, `bijou_stepper`, etc.) that produce Unicode box-drawing output for monospace chat contexts without ANSI escape codes.

Think's MCP server (`bin/think-mcp.js`) currently returns plain text/JSON. Wire bijou-mcp components into the response path so MCP clients (Claude Code, Cursor, etc.) get nicely formatted tables for stats, trees for session hierarchies, inspectors for thought metadata, and timelines for session context — all rendering cleanly in chat UI.

Potential surfaces:
- `bijou_table` for stats buckets and prompt metrics
- `bijou_tree` for session → thought hierarchies
- `bijou_inspector` for thought inspect metadata and reflect receipts
- `bijou_timeline` or `bijou_stepper` for session progression
- `bijou_box` for browse window context
- `bijou_dag` for reflect lineage graphs
