# think

> Capture now. Understand later.

`think` is a local-first system for capturing raw thoughts exactly as they happen, then making their evolution explorable later.

It is not a notes app.
It is not a dashboard.
It is not a daemon-first personal API.

It is infrastructure for cheap, exact, replayable thought capture.

## Current Status

`M0` and `M1` are complete.
`M2` tests-as-spec are now in progress.
Current version: `0.1.0`.

What exists today:

- raw CLI capture via `think "..."` or `node ./bin/think.js "..."`
- explicit read-only CLI surfaces via `think --recent` and `think --stats`
- first-run bootstrap of a private local repo under `~/.think/repo`
- exact raw-text preservation
- plain newest-first recent listing
- best-effort upstream backup
- executable acceptance tests for the implemented behavior

What does not exist yet:

- macOS menu bar app
- global hotkey capture panel
- brainstorm mode
- reflection mode
- x-ray mode
- embeddings
- clustering
- dashboard UI

## Milestone Development Loop

This repo uses an explicit milestone loop:

1. design docs first
2. tests as spec second
3. implementation third
4. retrospective
5. rewrite the root README to reflect reality
6. close the milestone

That loop is how the repo stays aligned with reality instead of drifting into stale docs or speculative implementation.

## Product Doctrine

- Raw capture is sacred.
- Capture must be cheap.
- Capture first. Interpret later.
- Never mix capture and interpretation in the same user moment.
- Provenance matters.
- Replay matters.
- The substrate may be sophisticated; the capture experience cannot feel sophisticated.

If capture feels like “using a system” instead of “writing a thought down,” the product is already drifting.

## How It Works Today

`think` writes raw entries into a private local Git/WARP-backed repo.

The current shape is:

- direct writer: CLI
- local store: `~/.think/repo`
- day-one backup model: best-effort upstream push after local success
- read surfaces: plain `--recent` and plain `--stats`

Capture success means the local save succeeded.
Backup is separate and best-effort.
Read commands are explicit flags so literal thoughts like `"recent"` and `"stats"` stay capturable.

Normal user-facing output stays intentionally boring:

- `Saved locally`
- `Backed up`
- `Backup pending`

The product should not require the user to think about refs, commits, pushes, pulls, or graph internals during normal use.

## Usage

From the repo root:

```bash
node ./bin/think.js "turkey is good in burritos"
node ./bin/think.js --recent
node ./bin/think.js --stats
node ./bin/think.js --stats --bucket=day
node ./bin/think.js --stats --since=7d
```

If you install or link the package entrypoint, the intended commands are:

```bash
think "turkey is good in burritos"
think --recent
think --stats
```

`--recent` and `--stats` are read-only commands.
They should not create local app state on their own.

To enable day-one backup, set `THINK_UPSTREAM_URL` to a reachable Git remote or bare repo path before capture:

```bash
THINK_UPSTREAM_URL=/path/to/private-upstream.git node ./bin/think.js "backup this too"
```

For trace output during a command, use `--verbose`. This emits JSONL progress events on `stderr` while preserving the normal human-facing message on `stdout`:

```bash
node ./bin/think.js --verbose "trace this capture"
```

## Tests Are The Spec

This repo follows a hard rule:

- design docs define intent
- executable tests define the actual spec
- implementation follows

There is no prose-spec layer between design and tests.

Acceptance tests live under [test/acceptance](/Users/james/git/think/test/acceptance).
Reusable fixtures live under [test/fixtures](/Users/james/git/think/test/fixtures).
Shared assertions live under [test/support](/Users/james/git/think/test/support).

Run the acceptance suite with:

```bash
npm test
```

The current Milestone 1 suite is green for the implemented raw-capture CLI path. Later-mode behavior remains intentionally deferred until those modes exist.

## Repo Guide

Start with these:

- [CONTRIBUTING.md](/Users/james/git/think/CONTRIBUTING.md)
- [CHANGELOG.md](/Users/james/git/think/CHANGELOG.md)
- [docs/design/README.md](/Users/james/git/think/docs/design/README.md)
- [docs/design/0005-m2-macos-capture-surface.md](/Users/james/git/think/docs/design/0005-m2-macos-capture-surface.md)
- [docs/design/0006-stats-command.md](/Users/james/git/think/docs/design/0006-stats-command.md)
- [docs/design/ROADMAP.md](/Users/james/git/think/docs/design/ROADMAP.md)
- [docs/retrospectives/m1-capture-core-and-upstream-backup.md](/Users/james/git/think/docs/retrospectives/m1-capture-core-and-upstream-backup.md)
- [BACKLOG.md](/Users/james/git/think/BACKLOG.md)

Important implementation files:

- [bin/think.js](/Users/james/git/think/bin/think.js)
- [src/cli.js](/Users/james/git/think/src/cli.js)
- [src/store.js](/Users/james/git/think/src/store.js)
- [src/git.js](/Users/james/git/think/src/git.js)
- [src/paths.js](/Users/james/git/think/src/paths.js)

## Development Standard

When in doubt:

- choose less structure
- choose lower latency
- choose fewer fields
- choose local-first
- choose behavior over architecture
- keep `recent` boring
- protect the capture moment from intelligence creep
