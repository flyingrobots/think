# 0020 Browse Bootstrap Benchmark

Status: draft for review

## Sponsor

### Sponsor Human

A maintainer diagnosing slow `think --browse` startup who needs a stable before/after measure instead of relying on feel.

### Sponsor Agent

An agent improving graph reads and migration behavior that needs a reproducible benchmark to prove whether browse bootstrap got better or worse.

## Hill

If `think` changes browse bootstrap logic or graph read behavior, both humans and agents can compare the current implementation against a stable local benchmark fixture and see whether browse startup improved, regressed, or stayed flat.

## Playback Questions

### Human Playback

- Is there one command that generates a realistic local archive fixture and reports the browse startup baseline clearly?
- Can a maintainer compare before and after without manually reconstructing the same repo shape?

### Agent Playback

- Does the benchmark report expose explicit fixture and metric data rather than forcing output scraping?
- Can the same benchmark be rerun after graph migration work with comparable inputs?

## Non-Goals

This note does not:

- define an end-user latency budget for `browse`
- benchmark full TTY rendering or terminal emulator variance
- replace subjective playback for the browse UX itself
- benchmark every read surface in `think`
- require a large archival dataset from real user data

## Problem

`think --browse` currently feels slow to start.

We already know the hot path is dominated by pre-first-paint browse bootstrap work rather than by TUI rendering alone.

Before changing the graph model or read path, we need a stable way to say:

- how slow is it now?
- what part of the startup path are we measuring?
- did the migration/refactor actually help?

Without that, every “improvement” risks becoming anecdotal.

## Benchmark Decision

The benchmark should measure:

- **browse bootstrap latency**

Definition:

> Time required to prepare the initial browse shell data for the first screen on a fixed synthetic repo fixture.

For the current implementation, that means the work done before the live TUI can render its first useful frame.

This benchmark intentionally excludes:

- terminal emulator paint variance
- human interaction delay
- post-startup navigation work

## Why Bootstrap Instead Of Full Interactive TTY Timing

Full interactive TTY timing is too noisy for the first corrective benchmark:

- terminal behavior varies
- scripted test mode does extra preload work that the live path does not
- the real performance bug is currently in archive read/bootstrap, not in key handling

So the benchmark should focus on the deterministic substrate:

- fixture repo shape
- browse bootstrap path
- explicit measured durations

If later we want a higher-level smoke benchmark for end-to-end TTY startup, that can be added separately.

## Fixture Shape

The benchmark should generate a synthetic local repo with:

- `100` raw capture thoughts by default
- `10` sessions by default
- `10` captures per session by default

Session timing shape:

- captures within a session are spaced close enough to remain in one `session_attribution` bucket
- sessions are separated by a gap larger than the 5-minute session idle threshold

The fixture should be:

- deterministic
- synthetic
- safe to regenerate
- local-only

It should not depend on:

- real personal data
- upstream remotes
- network

## Fixture Content

The text should be realistic enough to resemble the current archive:

- project notes
- design notes
- implementation observations
- session-local variation

But the exact wording does not need to be meaningful product copy.

The purpose is:

- stable graph size
- stable text/content loading
- stable session topology

## Report Shape

The benchmark should emit a machine-readable report with at least:

- benchmark name
- commit SHA
- timestamp
- Node version
- platform
- fixture configuration
- measured metric name
- warmup count
- measured run count
- raw run durations
- min / max / mean / median

Preferred output format:

- JSON

Optional human summary:

- compact text summary on stdout

## Capturing BEFORE

The benchmark should support recording a baseline report before any migration or graph-native read refactor work begins.

Recommended artifact:

- a committed JSON baseline under `docs/benchmarks/`

That baseline should include:

- the current commit SHA
- the fixture config
- the measured raw run durations
- the summary stats

This baseline is not universal truth.
It is a local comparison point for the current repo and machine context.

## Command Shape

Recommended command:

```bash
npm run benchmark:browse
```

Recommended optional output form:

```bash
node benchmarks/browse-bootstrap.js --out=docs/benchmarks/browse-bootstrap-before.json
```

The benchmark command should:

1. create a temporary fixture repo
2. populate the deterministic capture graph
3. run warmup iterations
4. run measured iterations
5. print a summary
6. optionally write a JSON report

## Test-As-Spec Requirement

Before relying on this benchmark, the repo should have a small acceptance/spec layer that proves:

1. the fixture generator creates the requested number of captures
2. the fixture generator creates the requested number of sessions
3. the benchmark emits the expected JSON report fields
4. the benchmark is runnable locally without upstream configuration

These tests should not assert specific latency numbers.
They should assert fixture and report correctness.

## Implementation Notes

The harness may use internal store/bootstrap helpers directly to generate the fixture quickly.

That is acceptable because:

- the benchmark target is browse bootstrap, not fixture-generation realism
- the fixture itself is not a product surface

But the measured bootstrap path should stay aligned with the actual browse implementation being optimized.

## Success Criteria

This slice is successful when:

- the repo has a reproducible browse benchmark command
- the benchmark produces a committed baseline report for the current implementation
- future graph migration/read work can compare against that same benchmark fixture and metric definition

## Next Move

After this design note:

1. add benchmark-fixture and report-shape specs
2. implement the harness
3. capture and commit the `BEFORE` baseline
4. only then start graph migration/read optimizations against it
