# Cross-surface failures still lack a typed error taxonomy

CLI, MCP, and store paths still throw or translate many failures as raw `Error` objects or generic strings.

Think needs a smaller set of owned failure types so human and machine surfaces can report the same truth consistently.
