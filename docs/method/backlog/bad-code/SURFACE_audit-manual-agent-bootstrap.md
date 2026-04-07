# Manual agent bootstrap is still hand-rolled

The current onboarding story still asks users to assemble agent wrappers and MCP config manually. See the `agent-think` heredoc in `docs/GUIDE.md` and the separate MCP setup prose in `README.md`.

This is DX debt, not missing product value. Think should own a single bootstrap path for isolated agent repos and MCP setup instead of teaching shell scripting in the install guide.
