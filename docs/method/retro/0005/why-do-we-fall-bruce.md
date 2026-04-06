# Retrospective: 0005 — Why do we fall, Bruce?

## Outcome

**Hill met.**

## What shipped

- `src/policies.js` — named Alfred policies for Think's async operations
- `createPushPolicy()` — timeout (1.5s) + retry (1, exponential, full jitter) for upstream backup push
- `capturePolicy` — timeout (10s) around MCP capture WARP graph writes
- `git.js` refactored from inline `retry(timeout(...))` to `policy.execute()`
- `service.js` capture path wrapped with `capturePolicy`

## Playback

### Agent perspective

1. Named Policy in git.js? **Yes** — `createPushPolicy()` returns a composed policy, used via `policy.execute()`.
2. MCP capture timeout? **Yes** — `capturePolicy` wraps save + finalize with a 10s timeout.
3. Policies in one module? **Yes** — `src/policies.js`.
4. Existing tests pass? **Yes** — 106/106, no modifications.

### Human perspective

5. Resilience visible in one file? **Yes** — `src/policies.js`.
6. Capture works the same? **Yes** — no behavior change for users.

## Drift check

Dropped circuit breaker from scope (premature without failure data). This was already marked out-of-scope in the design doc. No unintended drift.

## New debt

None.

## Cool ideas

- Add Alfred telemetry hooks to surface retry/timeout events in `--verbose` output.
- Consider `alfred-live` for runtime-tunable policy values (e.g., push timeout) without redeploy.
