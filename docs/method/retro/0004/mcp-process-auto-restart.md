# Retrospective: 0004 — MCP process auto-restart

## Outcome

**Hill met.**

## What shipped

- Transport error detection with `isTransportError` flag on `CaptureFailure`
- One automatic reconnection attempt on transport failure (stop, reset, start, re-initialize, retry)
- Application-level MCP errors (validation, empty thought) pass through without retry
- 3 new tests: reconnect after crash, fail after double crash, reset initialized state
- 43 Swift tests, 106 Node tests — all passing

## Playback

### Agent perspective

1. Detects dead transport? **Yes** — catches errors with `isTransportError: true`.
2. Re-initializes after respawn? **Yes** — `reconnect()` sets `initialized = false`, retry calls `ensureInitialized()`.
3. Maximum retry limit? **Yes** — one retry attempt, no loop.
4. Resets initialized state? **Yes** — test verifies two full init+capture sequences.
5. Tests with mock transport? **Yes** — `CrashRecoveryMockTransport`.

### Human perspective

6. Next capture succeeds after crash? **Yes** — tested.
7. No visible disruption? **Expected** — the retry adds one module-load delay (~2.3s) but no error flash.
8. Gives up after repeated failure? **Yes** — throws `CaptureFailure` with reconnection context.

## Drift check

Minor drift: the design scoped `isTransportError` to the adapter, but it was added to `CaptureFailure` (a shared type). This is the right place — the flag is meaningful for any adapter, not just MCP. Not a violation, just a broader-than-planned placement.

## New debt

None.

## Cool ideas

None beyond what's already in the backlog (Bruce, health checks).
