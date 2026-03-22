# think

> Capture now. Understand later.

`think` is a local-first cognitive capture system for preserving raw thoughts exactly as they happen, then helping their evolution become visible later.

It is not a notes app.
It is not a dashboard.
It is not "Git but semantic."

It is infrastructure for cheap, exact, replayable thought capture.

## Doctrine

- Raw capture is sacred.
- Capture must be cheap.
- Capture first. Interpret later.
- Never mix capture and interpretation in the same user moment.
- Provenance matters.
- Replay matters.
- The substrate may be sophisticated; the capture experience cannot feel sophisticated.

If `think "..."` does not feel natural, the product is already off track.

## Product Shape

The intended long-term modes are:

- `think "..."`: raw capture
- `think recent`: plain chronological re-entry
- `think brainstorm "..."`: deliberate idea expansion
- `think reflect`: dialogue-first reflection
- `think xray`: explicit structural inspection

The capture path is the center. Everything else is downstream of that.

## Current Architecture

`think` is not daemon-first.

The current design centers on:

- a private local Git/WARP-backed repo under `~/.think/repo`
- direct writers, starting with the CLI
- day-one private upstream backup
- eventual richer modes layered on top of immutable raw entries

Capture success means the local save succeeded.
Backup is separate and best-effort.

Default user language should stay boring:

- `Saved locally`
- `Backed up`
- `Backup pending`

The user should not need to think about Git, refs, push, pull, or graph structure during normal use.

## Milestone 1

Milestone 1 is intentionally narrow:

- direct CLI raw capture
- first-run local repo bootstrap
- honest upstream backup behavior
- plain `recent`
- raw-entry immutability
- executable acceptance tests for the behavior above

Not in Milestone 1:

- macOS overlay UX
- brainstorm mode
- reflection mode
- x-ray mode
- embeddings
- clustering
- dashboard UI

## Tests Are The Spec

This repo follows a hard rule:

- design docs define intent
- executable tests define the actual spec
- implementation follows

There is no extra prose-spec layer between design and tests.

Current acceptance tests live under [test/acceptance](/Users/james/git/think/test/acceptance), with reusable fixtures under [test/fixtures](/Users/james/git/think/test/fixtures) and shared assertions under [test/support](/Users/james/git/think/test/support).

Run them with:

```bash
npm test
```

At the moment, the Milestone 1 suite is expected to fail until the CLI exists.

## Design Package

The approved design work is in [docs/design/README.md](/Users/james/git/think/docs/design/README.md).

Start there, then read:

- [docs/design/0001-product-frame.md](/Users/james/git/think/docs/design/0001-product-frame.md)
- [docs/design/0002-v0-architecture.md](/Users/james/git/think/docs/design/0002-v0-architecture.md)
- [docs/design/0003-spec-and-test-strategy.md](/Users/james/git/think/docs/design/0003-spec-and-test-strategy.md)
- [docs/design/0004-modes-and-success-metrics.md](/Users/james/git/think/docs/design/0004-modes-and-success-metrics.md)
- [docs/design/ROADMAP.md](/Users/james/git/think/docs/design/ROADMAP.md)

Deferred ideas live in [BACKLOG.md](/Users/james/git/think/BACKLOG.md). They are intentionally not approved scope.

## Development Standard

When in doubt:

- choose less structure
- choose lower latency
- choose fewer fields
- choose local-first
- choose behavior over architecture
- protect the capture moment from intelligence creep
