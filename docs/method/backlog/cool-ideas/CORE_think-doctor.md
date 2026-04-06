# think --doctor

A health check command that verifies:

- Local repo exists and is a valid git repo
- Graph model version is current (no migration needed)
- Upstream URL is reachable (if configured)
- MCP server can start and respond to initialize
- Capture path works end-to-end (write + read back)

Like `git fsck` for Think. Useful for debugging setup issues and for agents to verify their environment before a session.
