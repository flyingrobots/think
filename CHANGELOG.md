# Changelog

All notable changes to `think` will be documented in this file.

This project starts versioning at `0.1.0`.

Release discipline:

- milestone closeout produces the release candidate state
- `package.json` version is bumped on the release commit
- a Git tag is created on the commit that lands on `main` for that milestone release

## [Unreleased]

### Added

- config-driven local thought repo targeting via `THINK_REPO_DIR`, while keeping `~/.think/repo` as the default
- macOS prompt-UX telemetry capture as buffered local JSONL session summaries, including visibility, typing, abandonment, submit-to-hide, and submit-to-local-save timings without storing prompt text

## [0.3.0] - 2026-03-23

Third milestone release for `think`.

### Added

- `--json` mode for implemented CLI commands, with JSONL-only output on `stdout`
- acceptance coverage for machine-readable capture, recent, stats, and validation-failure output
- explicit M3 reflect plumbing via `--reflect=<seedEntryId>` and `--reflect-session=<sessionId> ...`, with `--brainstorm*` retained as compatibility aliases
- deterministic brainstorm receipts, separate stored derived entries, and preserved seed/session lineage
- first Bijou-based interactive reflect shell for real TTY use, layered over the same M3 plumbing contract
- interactive seed picking for bare `--reflect` in a real TTY, while seeded explicit start remains the plumbing path
- seed-first deterministic challenge and constraint prompts instead of archive-guessed contrast
- reflect seed picking no longer truncates choices arbitrarily and now echoes the full selected seed in the interactive shell
- reflect now refuses low-signal status or narrative seeds instead of forcing every raw capture through a pressure-test prompt
- ineligible reflect seeds now suggest one or two recent eligible alternatives
- explicit reflect prompt-family selection via `--reflect-mode=challenge|constraint|sharpen`
- user-facing deterministic naming now surfaces the mode as `Reflect`

### Notes

- `M3` is complete
- `M4` is next
- the milestone clarified that deterministic pressure-testing and future LLM-assisted spitballing are different product jobs

## [0.2.0] - 2026-03-22

Second milestone release for `think`.

### Added

- explicit read-only CLI flags: `think --recent` and `think --stats`
- `think --stats` for plain capture counts without turning the CLI into a dashboard
- stats filters via `--from`, `--to`, and `--since`
- stats bucketing via `--bucket=hour|day|week`
- deterministic clock injection for stats tests via `THINK_TEST_NOW`
- native macOS menu bar app and global hotkey capture surface
- transient macOS capture panel built as a thin adapter over the existing CLI capture core
- menu bar restart cue when a newer local macOS build is detected on disk
- menu bar capture now dismisses immediately on submit and uses the menu bar icon for saving / success / failure state

### Notes

- `M2` is complete
- `M3` is next

## [0.1.0] - 2026-03-22

Initial milestone release for `think`.

### Added

- local-first raw CLI capture via `think "..."`
- first-run bootstrap of a private local repo under `~/.think/repo`
- exact raw-text preservation using Git/WARP content attachment
- plain newest-first recent listing
- explicit hidden-ref backup push behavior for WARP refs
- non-blocking backup behavior with honest `Backup pending` fallback
- `--verbose` JSONL trace output on `stderr`
- deterministic acceptance suite with temp app-home and temp bare-remote fixtures
- design package, milestone retrospective, backlog, and contributor guide

### Notes

- `M0` and `M1` are complete
- `M2` design is in progress
