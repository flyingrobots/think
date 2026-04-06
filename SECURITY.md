# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `think`, please report it responsibly.

**Email:** security@flyingrobots.co

Please include:

- A description of the vulnerability
- Steps to reproduce
- The version of `think` affected
- Any relevant logs or screenshots

We will acknowledge your report within 72 hours and provide an estimated timeline for a fix.

## Scope

Think is a local-first tool. Its security surface includes:

- **Local file access** — Think reads and writes to `~/.think/` and the configured `THINK_REPO_DIR`. It does not expose a network listener.
- **Upstream backup** — If configured, Think pushes WARP refs to a Git remote over SSH or HTTPS. The remote URL is set by the operator.
- **MCP server** — The stdio MCP server (`think-mcp`) communicates over stdin/stdout with its parent process. It does not open network ports.
- **macOS app** — The menu bar app registers a `think://` URL scheme. Only the `capture` route is handled; all other URLs are rejected.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.5.x   | Yes       |
| < 0.5   | No        |
