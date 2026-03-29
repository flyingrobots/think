# M4 Retrospective: Prompt Telemetry Read Surface

Date: 2026-03-29
Status: complete

## Slice Summary

This slice made the recorded macOS prompt telemetry inspectable through a boring CLI and JSON surface instead of leaving it trapped in raw JSONL.

Delivered behavior:

- `think --prompt-metrics` now reports factual prompt-session counts
- timing medians are exposed for:
  - trigger to visible
  - typing duration
  - submit to hide
  - submit to local save
- `--since`, `--from`, `--to`, and `--bucket` now filter prompt telemetry with the same language as `--stats`
- `think --json --prompt-metrics` now emits explicit:
  - `prompt_metrics.summary`
  - `prompt_metrics.timing`
  - `prompt_metrics.bucket`
- the command works even when the thought repo has not been bootstrapped yet

Design commit:

- `af27407` - `Design prompt telemetry read surface`

Spec commit:

- `c214086` - `Add prompt telemetry read specs`

Implementation commit:

- `1206be3` - `Add prompt telemetry read surface`

## What We Set Out To Prove

This slice existed to prove:

- prompt telemetry could be read through a calm product surface rather than raw files
- the output could stay factual without drifting into dashboards or coaching
- human and agent consumers could inspect the same telemetry facts through plain and JSON contracts

## What Shipped

Implementation:

- [src/cli.js](../../src/cli.js)
- [src/store.js](../../src/store.js)
- [src/paths.js](../../src/paths.js)

Specification:

- [test/acceptance/prompt-metrics.test.js](../../test/acceptance/prompt-metrics.test.js)

Supporting design work:

- [docs/design/archive/0025-prompt-telemetry-read-surface.md](../design/archive/0025-prompt-telemetry-read-surface.md)

## Human Stakeholder Playback

Human playback verdict:

- pass

What the human stakeholder validated:

- the command feels factual enough
- the output shape is about right
- the surface is useful as a boring operational readout

## Agent Stakeholder Playback

Agent playback verdict:

- pass

Why:

- the JSON contract is explicit and inspectable
- no scraping of raw telemetry files is required
- the slice did not blur telemetry into graph/archive stats
- empty-state and validation behavior remain explicit

## Design-Conformance Check

Did implementation deviate from the approved design?

- no material drift

What matched:

- `--prompt-metrics` stayed a separate command instead of being folded into `--stats`
- the surface stayed factual and aggregate-oriented
- the same time-filter language as `--stats` was reused
- JSON rows remained explicit
- no dashboard, chart, or coaching behavior slipped in

One implementation correction during the slice:

- a stale validation variable name briefly broke unrelated migration tests

That was fixed before playback and did not change the slice design.

## What We Learned

- prompt telemetry was already valuable; it mostly needed a real read surface
- keeping telemetry separate from archive stats preserves product clarity
- the sidecar JSONL source is fine as long as the CLI contract above it is explicit and boring

## Recommendation

Close this slice.

Menu bar reporting, charts, or any `--stats` integration should remain deferred until future playback proves a stronger need.
