# 0005: Why do we fall, Bruce?

So we can `retry({ backoff: 'exponential', jitter: 'decorrelated' })`.

## Sponsors

- **Human:** James
- **Agent:** Claude

## Hill

Think's Node-side async operations use named Alfred policies instead of inline retry/timeout wiring, so resilience behavior is visible, testable, and composable.

## Playback questions

### Agent perspective

1. Does `git.js` use a named Alfred `Policy` composition instead of bare `retry()` + `timeout()` calls?
2. Does the MCP capture service have a timeout policy so a hung WARP write doesn't block forever?
3. Are the policies defined in a single module that can be inspected and reused?
4. Do the existing tests still pass without modification?

### Human perspective

5. Is the resilience behavior visible by reading one file?
6. Does capture still work the same from the user's perspective?

## Scope

### In scope

- Extract a `src/policies.js` module with named Alfred policies
- Refactor `git.js` push path to use a composed `Policy` instead of inline `retry(timeout(...))`
- Add a timeout policy to the MCP capture service (`service.js`) for the WARP graph write
- Keep the same timeout/retry values — this is a refactor, not a tuning change

### Out of scope

- Circuit breaker (needs failure data first — premature)
- Changing timeout/retry values (separate tuning cycle)
- Swift-side resilience (Alfred is JS-only)
- Adding new resilience to CLI capture (it goes through the same store calls)

## Accessibility / assistive reading posture

Not applicable — internal refactor.

## Localization / directionality posture

Not applicable.

## Agent inspectability / explainability posture

Policies are named and defined in one module. An agent can read `src/policies.js` to understand all resilience behavior.

## Non-goals

- Adding telemetry or observability to policies (future)
- Changing user-visible behavior in any way
- Using alfred-live or the control plane
