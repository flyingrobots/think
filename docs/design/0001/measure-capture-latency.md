# 0001: Measure capture latency

## Sponsors

- **Human:** James
- **Agent:** Claude

## Hill

A developer can measure warm-path capture latency from the CLI and detect regressions, without adding flaky timing assertions to the deterministic acceptance suite.

## Playback questions

### Agent perspective

1. Does a dedicated benchmark script measure warm-path CLI capture latency end-to-end?
2. Does the benchmark produce machine-readable output (JSONL) with individual sample timings and summary statistics?
3. Does the benchmark run against an isolated temp repo so results are not affected by archive size?
4. Can an agent run the benchmark non-interactively and parse the results?

### Human perspective

5. Can the developer run a single command to see current capture latency?
6. Are the results honest — real end-to-end timings, not microbenchmarks of internal functions?
7. Is there a baseline committed so future regressions are visible in review?

## Scope

### In scope

- A benchmark script that captures N thoughts into a temp repo and reports per-capture and summary timings (min, max, median, mean, p95)
- An `npm run benchmark:capture` script entry
- Machine-readable JSONL output via `--json` or by default
- A committed baseline (median and p95) in the benchmark output or a doc
- The benchmark must run in under 30 seconds

### Out of scope

- Latency aggregates in `think --stats` (deferred — decide after we have data)
- macOS menu bar capture latency (separate surface, separate measurement)
- Network/upstream latency (backup is async, not on the critical path)
- CI enforcement of latency budgets (premature — get data first)

## Accessibility / assistive reading posture

Not applicable — this is a CLI benchmark with machine-readable output.

## Localization / directionality posture

Not applicable — numeric output only.

## Agent inspectability / explainability posture

The benchmark output is JSONL. An agent can parse individual sample timings and summary statistics directly. No prose to interpret.

## Non-goals

- Making capture faster (that's a separate cycle if the numbers warrant it)
- Automated regression detection in CI (get data first, automate later)
- Benchmarking anything other than the warm-path CLI capture
