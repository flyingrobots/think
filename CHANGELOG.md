# Changelog

All notable changes to `think` will be documented in this file.

This project starts versioning at `0.1.0`.

Release discipline:

- milestone closeout produces the release candidate state
- `package.json` version is bumped on the release commit
- a Git tag is created on the commit that lands on `main` for that milestone release

## [Unreleased]

- added explicit stdin ingest via `think --ingest`, preserving the normal raw-capture contract and JSON envelope
- canonicalized JSON parsing and JSONL output through a shared deterministic JSON port so key ordering stays stable on read-in and write-out
- added a local stdio MCP server via `think-mcp` / `npm run mcp`, exposing typed `capture`, `recent`, `remember`, `browse`, `inspect`, `stats`, `prompt_metrics`, and `migrate_graph` tools over the existing Think runtime
- adopted System-Style JavaScript as the engineering standard for this repo
- adopted METHOD for project management with CORE, SURFACE, and REFLECT legends
- decomposed monolithic BACKLOG.md into filesystem-based METHOD lanes
- added ESLint with maximum strictness, CI workflow (GitHub Actions), and tag-triggered release workflow
- migrated git hooks from `.githooks/` to `scripts/hooks/` with pre-commit lint gate
- added M5 URL-capture core and menu bar app routing for `think://capture?text=...`
- added a real macOS app-bundle packaging path with registered `think` URL-scheme metadata via `npm run macos`

## [0.4.0] - 2026-03-29

Fourth milestone release for `think`.

### Added

- config-driven local thought repo targeting via `THINK_REPO_DIR`, while keeping `~/.think/repo` as the default
- macOS prompt-UX telemetry capture as buffered local JSONL session summaries, including visibility, typing, abandonment, submit-to-hide, and submit-to-local-save timings without storing prompt text
- preferred command-scoped CLI modifiers: `--count`, `--query`, and `--mode`
- `--count=<n>` and `--query=<text>` for tighter raw reentry without turning `recent` into a dashboard
- `--remember` for context-scoped recall, supporting both ambient project recall and explicit query recall
- `--remember --limit=<n>` and `--remember --brief` for bounded, triage-friendly recall without changing the underlying remember receipts or ranking mode
- `--prompt-metrics` for a factual read surface over macOS prompt telemetry, including counts, latency aggregates, optional time-window filters, and explicit JSON rows
- first explicit `--browse=<entryId>` read surface for navigating one raw thought with its immediate newer and older neighbors
- first explicit `--inspect=<entryId>` read surface for exposing exact raw entry metadata without narration
- first full-screen Bijou browse TUI for bare `--browse` in a real TTY, with a reader-first default view, visible thought metadata, a summon-only thought-log drawer, a jump palette, inspect receipts, and in-shell reflect
- session-context browse in both human and JSON surfaces, including visible session ids, a summon-only session drawer, and explicit `browse.context` / `browse.session_entry` rows
- explicit session traversal in browse, including session-position metadata, previous/next same-session movement in the TUI, honest boundary notices, and `browse.session_step` rows in JSON output
- calmer browse session presentation, including short visible entry ids in the reader-first shell, a structured session drawer, and a visible session start label without changing browse semantics
- canonical `thought:<fingerprint>` identity exposed in `inspect`
- first stored derivation bundle for raw thoughts:
  - canonical thought identity materialization
  - `seed_quality`
  - `session_attribution`
- passive ambient capture metadata for later recall:
  - cwd
  - git root
  - git remote
  - git branch
- direct derived reflect receipts exposed in human and JSON inspect output
- default `npm test` now excludes macOS Swift tests so the default/CI path stays cheap
- local pre-push hook support via `.githooks/pre-push` and `npm run install-hooks`
- browse bootstrap benchmark tooling via `npm run benchmark:browse`, including a deterministic 100-thought synthetic fixture and JSON baseline capture support
- separate benchmark harness specs via `npm run test:benchmarks`, keeping the default fast suite cheap
- explicit graph-migration gating:
  - raw capture now saves first and only then runs post-capture migration follow-through on outdated repos
  - graph-native commands now fail clearly on outdated repos for non-interactive use
  - `--json` now emits `graph.migration_required`
  - interactive human CLI flows now offer upgrade-or-cancel instead of silent mutation
- `graphModelVersion = 3` read-edge substrate:
  - new captures now maintain `latest_capture` and `older` graph-native browse edges
  - reflect writes now maintain `seeded_by`, `produced_in`, and `responds_to` operational edges
  - `think --migrate-graph` now backfills those `v3` edges additively
  - `inspect` now prefers direct reflect receipts through graph-native edges before falling back to legacy linkage props
- product read paths now follow `git-warp v15` read-handle discipline:
  - `browse`, `inspect`, `recent`, `remember`, and `stats` now read through `WarpApp -> worldline() -> observer(...)`
  - `core()` is no longer used for traversal/query in normal product paths
  - targeted content attachment reads remain a narrow `core()` escape hatch because `Worldline` / `Observer` do not expose content blobs directly
- official browse bootstrap `AFTER` benchmark captured:
  - `BEFORE` median: `4152.16075 ms`
  - `AFTER` median: `345.786625 ms`
- interactive graph upgrades now show a visible in-progress state for human CLI flows, then continue automatically into the requested command

### Removed

- deprecated CLI alias parsing for `--brainstorm*`, `--reflect-mode`, `--recent-count`, and `--recent-query`

### Notes

- `M4` is complete
- `M5` is next

## [0.3.0] - 2026-03-23

Third milestone release for `think`.

### Added

- `--json` mode for implemented CLI commands, with JSONL-only output on `stdout`
- acceptance coverage for machine-readable capture, recent, stats, and validation-failure output
- explicit M3 reflect plumbing via `--reflect=<seedEntryId>` and `--reflect-session=<sessionId> ...`, with `--brainstorm*` retained as compatibility aliases
- deterministic reflect receipts, separate stored derived entries, and preserved seed/session lineage
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
