# Changelog

All notable changes to `think` will be documented in this file.

This project starts versioning at `0.1.0`.

Release discipline:

- milestone closeout produces the release candidate state
- `package.json` version is bumped on the release commit
- a Git tag is created on the commit that lands on `main` for that milestone release

## [Unreleased]

### Added

- explicit read-only CLI flags: `think --recent` and `think --stats`
- `think --stats` for plain capture counts without turning the CLI into a dashboard
- stats filters via `--from`, `--to`, and `--since`
- stats bucketing via `--bucket=hour|day|week`
- deterministic clock injection for stats tests via `THINK_TEST_NOW`
- menu bar restart cue when a newer local macOS build is detected on disk
- menu bar capture now dismisses immediately on submit and uses the menu bar icon for saving / success / failure state

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
