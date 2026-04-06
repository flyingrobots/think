# Retrospective: 0001 — Measure capture latency

## Outcome

**Hill met.**

## What shipped

- `benchmarks/capture-latency.js` — warm-path CLI capture benchmark
- `npm run benchmark:capture` script entry
- 3 benchmark tests in `test/benchmarks/capture-latency.test.js`
- JSON and human-readable output modes

## Baseline (2026-04-03, Apple Silicon, Node v25.8.1)

| Metric | Value |
|--------|-------|
| Min | ~1,608 ms |
| Median | ~2,022 ms |
| Mean | ~2,025 ms |
| P95 | ~2,469 ms |
| Max | ~2,532 ms |

These are end-to-end wall-clock timings for a single `think --json "text"` invocation against a warm (already-bootstrapped) repo. They include Node startup, CLI parsing, WARP graph write, derivation, and finalization.

## Playback

### Agent perspective

1. Dedicated benchmark script? **Yes.**
2. Machine-readable output with timings and summary? **Yes.**
3. Isolated temp repo? **Yes.**
4. Non-interactive and parseable? **Yes.**

### Human perspective

5. Single command to see latency? **Yes** — `npm run benchmark:capture`.
6. Honest end-to-end timings? **Yes** — wall-clock, not microbenchmarks.
7. Committed baseline? **Yes** — this retro.

## Drift check

No drift. The implementation matches the design doc exactly. No scope creep, no deferred work.

## Observations

- **~2 seconds per capture is high.** Most of this is likely Node startup + WARP graph overhead, not the raw write. A future cycle could profile where time is spent.
- The browse benchmark (separate, pre-existing) measures an internal function call, not CLI invocation. This benchmark measures the full CLI path, which is what the user actually experiences.
- The benchmark does not enforce a latency budget. That's intentional — get data first, set thresholds later.

## New debt

None.

## Cool ideas

- Profile capture latency breakdown (Node startup vs. graph write vs. derivation) to find optimization targets.
- Add the capture baseline to CI as a non-blocking annotation (not a gate).
