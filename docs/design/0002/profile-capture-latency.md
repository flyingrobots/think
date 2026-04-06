# 0002: Profile capture latency breakdown

## Sponsors

- **Human:** James
- **Agent:** Claude

## Hill

A developer can see exactly where time is spent during a warm-path CLI capture, broken down by phase, so optimization targets are visible without guessing.

## Playback questions

### Agent perspective

1. Does the profiling produce a machine-readable phase-by-phase timing breakdown?
2. Can an agent identify which phase dominates capture latency from the output alone?
3. Is the profiling non-destructive (no changes to the capture path itself)?

### Human perspective

4. Can the developer see at a glance which phase is the bottleneck?
5. Are the phase boundaries honest — do they reflect real architectural seams, not arbitrary instrumentation points?

## Scope

### In scope

- Instrument the capture path with phase-level timing (e.g., CLI startup, repo ensure, graph open, raw save, derivation/finalization, upstream push attempt)
- Add a `--profile` flag or separate profiling mode to the benchmark script
- Report per-phase timings alongside the existing end-to-end measurement
- Run the profile and commit findings in this cycle's retro

### Out of scope

- Actually optimizing anything (that's the next cycle, informed by these numbers)
- Profiling the MCP path (separate surface)
- Profiling macOS capture panel latency
- Flame graphs or V8 CPU profiling (keep it simple — wall-clock phase timings)

## Accessibility / assistive reading posture

Not applicable — CLI profiling output.

## Localization / directionality posture

Not applicable — numeric output only.

## Agent inspectability / explainability posture

Phase timings are structured data. An agent can parse them directly.

## Non-goals

- Making capture faster (next cycle)
- Changing the capture path architecture
- Adding permanent instrumentation to production code (the profiling should be in the benchmark, not the runtime)
