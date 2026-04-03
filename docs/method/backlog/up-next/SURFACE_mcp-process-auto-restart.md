# MCP process auto-restart

Cycle 0003 noted as debt: if the MCP child process dies mid-session, ThinkMCPAdapter doesn't recover. Subsequent captures fail until the app is restarted.

Add a reconnection strategy — detect the dead process, respawn think-mcp, re-initialize, and retry the capture transparently.
