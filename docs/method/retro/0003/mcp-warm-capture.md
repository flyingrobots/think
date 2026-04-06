# Retrospective: 0003 — MCP warm capture for macOS app

## Outcome

**Hill met.**

## What shipped

- `ThinkMCPAdapter.swift` — minimal JSON-RPC client over `MCPTransport` protocol, conforms to `ThinkCapturing`
- `StdioMCPTransport.swift` — spawns a persistent child process with stdin/stdout pipes
- `ThinkMCPCommandResolver.swift` — resolves `bin/think-mcp.js` using the same upward search as `ThinkCLICommandResolver`
- `CaptureAppState.makeClient()` now prefers MCP, falls back to CLI
- 8 new tests with `MockMCPTransport`

## Architecture

```
ThinkCapturing (protocol)
  ├── ThinkCLIAdapter     (shells out per capture — ~2s cold start)
  └── ThinkMCPAdapter     (persistent child process — warm after first call)
        └── MCPTransport (protocol)
              └── StdioMCPTransport (real stdio process)
              └── MockMCPTransport  (tests)
```

The MCP adapter implements the minimal JSON-RPC subset needed: `initialize` handshake, `notifications/initialized`, and `tools/call`. No full MCP client library required.

## Playback

### Agent perspective

1. ThinkMCPAdapter conforms to ThinkCapturing? **Yes.**
2. Spawns think-mcp once and reuses? **Yes** — `startCount` test verifies single start.
3. Passes THINK_REPO_DIR and user environment? **Yes** — `StdioMCPTransport` receives full environment.
4. Falls back gracefully? **Yes** — `CaptureAppState.makeClient()` tries MCP first, CLI second.
5. Existing tests pass without modification? **Yes** — 32 original + 8 new = 40 total.

### Human perspective

6. Second capture faster than first? **Expected yes** — module load happens once at first capture.
7. Same repo as CLI? **Yes** — same `THINK_REPO_DIR` / `~/.think/repo` default.
8. Recovers from crash? **Partial** — the adapter doesn't auto-restart the child process yet. If the MCP process dies mid-session, subsequent captures will fail. Auto-restart is a natural follow-up.

## Drift check

No significant drift. The design called for `CaptureAppState.deinit` to terminate the child process — this happens implicitly when the `StdioMCPTransport` is deallocated, but an explicit `shutdown()` method was added for clarity. The adapter also exposes `shutdown()` publicly for the app to call.

## New debt

- **No auto-restart on MCP process crash.** If the child process dies, the adapter doesn't recover. Should add a reconnection strategy.

## Cool ideas

- Expose MCP read tools (recent, remember, browse) to the macOS app for a richer menu bar experience.
- Add a health check / heartbeat to detect a dead MCP process proactively.
