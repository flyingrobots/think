# Changelog

All notable changes to `think` will be documented in this file.

This project starts versioning at `0.1.0`.

Release discipline:

- milestone closeout produces the release candidate state
- `package.json` version is bumped on the release commit
- a Git tag is created on the commit that lands on `main` for that milestone release

## [0.1.0] - 2026-03-22

Initial milestone release for `think`.

### Added

- local-first raw CLI capture via `think "..."`
- first-run bootstrap of a private local repo under `~/.think/repo`
- exact raw-text preservation using Git/WARP content attachment
- plain newest-first `recent`
- explicit hidden-ref backup push behavior for WARP refs
- non-blocking backup behavior with honest `Backup pending` fallback
- `--verbose` JSONL trace output on `stderr`
- deterministic acceptance suite with temp app-home and temp bare-remote fixtures
- design package, milestone retrospective, backlog, and contributor guide

### Notes

- `M0` and `M1` are complete
- `M2` design is in progress
