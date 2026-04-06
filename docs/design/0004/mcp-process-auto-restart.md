# 0004: MCP process auto-restart

## Sponsors

- **Human:** James
- **Agent:** Claude

## Hill

If the MCP child process dies mid-session, the macOS app automatically respawns it and retries the capture transparently — the user never sees a failed capture due to a process crash.

## Playback questions

### Agent perspective

1. Does ThinkMCPAdapter detect a dead transport and attempt reconnection before failing?
2. Does reconnection re-initialize the MCP handshake after respawning?
3. Is there a maximum retry limit to prevent infinite respawn loops?
4. Does the adapter reset its initialized state so the next capture triggers a fresh handshake?
5. Are the reconnection paths covered by tests with a mock transport?

### Human perspective

6. If the MCP process crashes, does the next capture still succeed?
7. Is there any visible disruption to the user (delay, error flash, etc.)?
8. Does the app give up gracefully after repeated failures instead of spinning?

## Scope

### In scope

- Detect transport failure (send/receive throws) in ThinkMCPAdapter
- Reset initialized state, stop the dead transport, start a fresh one
- Retry the capture after reconnection (one retry attempt)
- Maximum reconnection attempts per capture (1 — don't loop)
- Tests: transport dies mid-capture, adapter reconnects and succeeds; transport dies repeatedly, adapter fails gracefully after max retries

### Out of scope

- Proactive health checks / heartbeats (cool-idea, not this cycle)
- Alfred policies on the Node side (Bruce stays in up-next for a future cycle)
- Circuit breaker pattern (future — needs sustained failure data first)
- Falling back to CLI adapter on MCP failure (the adapter either reconnects or throws)

## Accessibility / assistive reading posture

Not applicable — no UI changes.

## Localization / directionality posture

Not applicable — no user-facing text changes.

## Agent inspectability / explainability posture

Reconnection attempts are observable through the mock transport in tests. In production, failures surface as CaptureFailure with descriptive messages.

## Non-goals

- Making the MCP process immune to crashes (that's the server's job)
- Adding retry/backoff delays (one immediate retry is enough — the respawn itself takes ~2s module load)
- Changing the CLI fallback logic in CaptureAppState
