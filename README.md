# think

> Capture now. Understand later.

`think` is a local-first system for capturing raw thoughts exactly as they happen, then making their evolution explorable later.

It is not a notes app.
It is not a dashboard.
It is not a daemon-first personal API.

It is infrastructure for cheap, exact, replayable thought capture.

## Current Status

`M0`, `M1`, `M2`, and `M3` are complete.
`M4` is in progress.
Current version: `0.3.0`.

What exists today:

- raw CLI capture via `think "..."` or `node ./bin/think.js "..."`
- explicit read-only CLI surfaces via `think --recent`, `think --browse=<entryId>`, `think --inspect=<entryId>`, and `think --stats`
- machine-readable CLI output via `--json`, with JSONL-only streams for every implemented command
- first-run bootstrap of a private local repo, defaulting to `~/.think/repo`
- exact raw-text preservation
- newest-first recent listing, with optional count and query filters
- best-effort upstream backup
- first seeded reflect CLI flow via `--reflect` and `--reflect-session`
- first reader-first browse TUI with chronology and same-session traversal
- a native macOS menu bar app with a global hotkey capture panel
- quiet menu bar feedback for saving, success, failure, and restart-needed state
- first stored derivation bundle for `inspect`, including:
  - canonical `thought:<fingerprint>` identity
  - `seed_quality`
  - `session_attribution`
  - direct `Reflect` receipts
- executable acceptance tests for the implemented CLI and macOS behavior

What does not exist yet:

- richer reflection dialogue mode
- x-ray mode
- explicit LLM-assisted spitball mode
- archive-driven spitball recombine mode
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

At the start of each design cycle, the docs should explicitly name:

- sponsor human
- sponsor agent
- hill
- playback questions
- non-goals

At the end of each cycle, the closeout should explicitly evaluate both:

- human stakeholder playback
- agent stakeholder playback

For this project, the human stakeholder is the user and the agent stakeholder is the coding/CLI consumer perspective.

The split of labor should stay explicit:

- the human stakeholder judges whether the UX is actually good to use
- the agent stakeholder judges whether the explicit command and JSON contract stays coherent and parity-preserving

When running human playback, the coding agent should provide:

- the commands to run
- the steps to take
- what to inspect from the human perspective

Then stop and wait for the human verdict before proceeding beyond playback.

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

- direct writers: CLI and macOS menu bar app
- local store: configurable via `THINK_REPO_DIR`, defaulting to `~/.think/repo`
- day-one backup model: best-effort upstream push after local success
- read surfaces: filtered `--recent`, explicit `--browse=<entryId>`, explicit `--inspect=<entryId>`, and plain `--stats`

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
node ./bin/think.js --recent --count=5
node ./bin/think.js --recent --query=warp
node ./bin/think.js --browse=<entryId>
node ./bin/think.js --inspect=<entryId>
node ./bin/think.js --stats
node ./bin/think.js --stats --bucket=day
node ./bin/think.js --stats --since=7d
node ./bin/think.js --reflect
node ./bin/think.js --reflect=<seedEntryId> --mode=sharpen
node ./bin/think.js --reflect-session=<sessionId> "push the idea further"
```

If you install or link the package entrypoint, the intended commands are:

```bash
think "turkey is good in burritos"
think --recent
think --stats
```

`--count=<n>` limits `--recent` to the newest `n` raw captures. `--query=<text>` filters `--recent` by case-insensitive text match.

`--browse=<entryId>` shows one raw capture with its immediate newer and older neighbors, plus explicit session context in JSON mode.
In a real TTY, bare `--browse` opens a full-screen Bijou browse TUI on the newest raw capture. The default view is reader-first: the current thought owns the screen, with timestamp, relative time, chronology position, entry id, session id, and session position visible up front. Use `j`/`k` or the arrow keys to move older and newer in chronology, `[` and `]` to move to the previous and next thoughts in the current session, `s` to reveal the session drawer, `l` to reveal the thought log drawer, `/` to open the jump palette, `i` to reveal inspect receipts, `r` to open an in-shell `Reflect` modal, and `q` to quit.

`--inspect=<entryId>` exposes the stored raw capture, canonical thought identity, first derived receipts (`seed_quality` and `session_attribution`), and any direct `Reflect` descendants without summarizing or narrating the thought.

In a real TTY, bare `--reflect` opens an interactive seed picker. `--mode=challenge|constraint|sharpen` can be used to request a specific pressure family.

`--recent`, `--browse`, `--inspect`, and `--stats` are read-only commands.
They should not create local app state on their own.

To enable day-one backup, set `THINK_UPSTREAM_URL` to a reachable Git remote or bare repo path before capture:

```bash
THINK_UPSTREAM_URL=/path/to/private-upstream.git think "backup this too"
```

To target a different local thought repo, set `THINK_REPO_DIR`. If unset, `think` still uses the default private repo at `~/.think/repo`:

```bash
THINK_REPO_DIR=/path/to/another-mind think "route this elsewhere"
```

For trace output during a command, use `--verbose`. This emits JSONL progress events on `stderr` while preserving the normal human-facing message on `stdout`:

```bash
think --verbose "trace this capture"
```

For machine-readable command output, use `--json`. In `--json` mode, all command output is emitted as JSONL and human-readable text is suppressed:

- `stdout` carries ordinary data and success rows
- `stderr` carries structured warnings and errors

```bash
think --json "capture this as JSONL"
think --json --recent
think --json --stats --bucket=day
```

### macOS App

Launch the native menu bar app from the repo root:

```bash
npm run macos
```

The current default hotkey is `Command` + `Shift` + `I`.

The panel is intentionally thin:

- hotkey
- type
- Enter
- gone

The menu bar icon then carries the save lifecycle so the panel can disappear immediately without losing confirmation.

The macOS app also records buffered local prompt-UX telemetry summaries as JSONL, without storing prompt text, so timing and abandonment patterns can be reviewed later. By default this lives at `~/.think/metrics/prompt-ux.jsonl`. Set `THINK_PROMPT_METRICS_FILE` to override the file location.

## Tests Are The Spec

This repo follows a hard rule:

- design docs define intent
- executable tests define the actual spec
- implementation follows

There is no prose-spec layer between design and tests.

Acceptance tests live under [test/acceptance](/Users/james/git/think/test/acceptance).
Reusable fixtures live under [test/fixtures](/Users/james/git/think/test/fixtures).
Shared assertions live under [test/support](/Users/james/git/think/test/support).
Swift menu bar tests live under [macos/Tests](/Users/james/git/think/macos/Tests).

Run the default suite with:

```bash
npm test
```

Run the full local suite, including the macOS Swift tests, with:

```bash
npm run test:local
```

Install the local pre-push hook so macOS Swift tests stay local and off the default/CI path:

```bash
npm run install-hooks
```

The current `M1` and `M2` suites are green for the implemented behavior.
The current `M3` reflect suite is green for the implemented behavior.
The first `M4` read-mode, derivation-bundle, and session-context browse suites are green for the implemented behavior.

## Repo Guide

Start with these:

- [CONTRIBUTING.md](/Users/james/git/think/CONTRIBUTING.md)
- [CHANGELOG.md](/Users/james/git/think/CHANGELOG.md)
- [docs/design/README.md](/Users/james/git/think/docs/design/README.md)
- [docs/design/0005-m2-macos-capture-surface.md](/Users/james/git/think/docs/design/0005-m2-macos-capture-surface.md)
- [docs/design/0006-stats-command.md](/Users/james/git/think/docs/design/0006-stats-command.md)
- [docs/design/ROADMAP.md](/Users/james/git/think/docs/design/ROADMAP.md)
- [docs/retrospectives/m1-capture-core-and-upstream-backup.md](/Users/james/git/think/docs/retrospectives/m1-capture-core-and-upstream-backup.md)
- [docs/retrospectives/m2-macos-capture-surface.md](/Users/james/git/think/docs/retrospectives/m2-macos-capture-surface.md)
- [docs/retrospectives/m3-reflect-mode.md](/Users/james/git/think/docs/retrospectives/m3-reflect-mode.md)
- [docs/retrospectives/m4-session-context-browse.md](/Users/james/git/think/docs/retrospectives/m4-session-context-browse.md)
- [BACKLOG.md](/Users/james/git/think/BACKLOG.md)

Important implementation files:

- [bin/think.js](/Users/james/git/think/bin/think.js)
- [src/cli.js](/Users/james/git/think/src/cli.js)
- [src/store.js](/Users/james/git/think/src/store.js)
- [src/git.js](/Users/james/git/think/src/git.js)
- [src/paths.js](/Users/james/git/think/src/paths.js)
- [macos/Sources/ThinkMenuBarApp/ThinkMenuBarApp.swift](/Users/james/git/think/macos/Sources/ThinkMenuBarApp/ThinkMenuBarApp.swift)

## Development Standard

When in doubt:

- choose less structure
- choose lower latency
- choose fewer fields
- choose local-first
- choose behavior over architecture
- keep `recent` boring
- protect the capture moment from intelligence creep

## License

`think` is licensed under the Apache License 2.0.
See [LICENSE](/Users/james/git/think/LICENSE).
