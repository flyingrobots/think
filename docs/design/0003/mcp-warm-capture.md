# 0003: MCP warm capture for macOS app

## Sponsors

- **Human:** James
- **Agent:** Claude

## Hill

The macOS menu bar app captures thoughts in under 100ms after first launch, by keeping a persistent MCP child process warm instead of paying the ~2.3s module load tax on every capture.

## Playback questions

### Agent perspective

1. Does a new `ThinkMCPAdapter` conform to `ThinkCapturing` and route captures through the persistent MCP child process?
2. Does the adapter spawn `think-mcp` once and reuse it across captures?
3. Does the adapter pass `THINK_REPO_DIR` and the user's environment to the child process?
4. Does the adapter fall back gracefully if the MCP process dies or fails to start?
5. Are the existing `CapturePanelModel` and `ThinkCaptureURLHandler` tests still passing without modification?

### Human perspective

6. Is the second capture noticeably faster than the first?
7. Does the macOS app still save thoughts to the same repo as the CLI?
8. Does the app recover if the MCP process crashes mid-session?

## Scope

### In scope

- `ThinkMCPAdapter.swift` — persistent Process with stdin/stdout pipes, minimal JSON-RPC client (initialize handshake + tool call)
- `ThinkMCPCommandResolver.swift` — resolve path to `bin/think-mcp.js` (reuse upward search pattern from `ThinkCLICommandResolver`)
- Update `CaptureAppState.makeClient()` to prefer MCP, fall back to CLI
- Pass `THINK_REPO_DIR` and full user environment to the child process
- Terminate the MCP child process on app exit
- Tests for the adapter (mock the JSON-RPC transport, not the real process)

### Out of scope

- Using MCP tools beyond `capture` from the macOS app (future cycle)
- Adding MCP to the URL capture path (it already goes through `ThinkCapturing`)
- Swift MCP SDK dependency (we implement the minimal JSON-RPC ourselves)
- Daemon mode or launchd integration

## Accessibility / assistive reading posture

Not applicable — no UI changes. The capture panel is identical.

## Localization / directionality posture

Not applicable — no user-facing text changes.

## Agent inspectability / explainability posture

The MCP protocol is JSON-RPC. All messages are structured and inspectable. The adapter logs spawn and connection events for debugging.

## Non-goals

- Full MCP client implementation (we only need initialize + tools/call)
- Exposing MCP read tools (recent, browse, etc.) to the macOS app
- Changing the capture panel UI in any way
