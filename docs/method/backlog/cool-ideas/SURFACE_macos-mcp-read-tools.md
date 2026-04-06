# MCP read tools in macOS menu bar

The MCP server has 8 tools but the macOS app only uses `capture`. Expose read tools through the menu bar:

- Recent thoughts in a dropdown
- Remember (ambient project recall) surfaced contextually
- Quick browse/inspect without opening a terminal

The ThinkMCPAdapter already holds a persistent connection — adding tool calls is straightforward.
