# Changelog

All notable changes to `think` will be documented in this file.

This project starts versioning at `0.1.0`.

Release discipline:

- cycle closeout produces the release candidate state
- `package.json` version is bumped on the release commit
- a Git tag is created on the commit that lands on `main` for that release

## Unreleased

- added `THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS` so operators on cold or slow
  repositories can raise the post-capture derived-work budget; an unusable value
  falls back to the 6s default rather than failing the capture
- extracted `src/capture-followthrough.js` as the single owner of the capture
  followthrough budget, deferral sentinel, and race, replacing the copies that
  had been duplicated between the CLI and MCP capture surfaces
- changed the MCP capture deferral warning to name the budget it exceeded, what
  the deferral actually skips, the knob that raises the budget, and that retrying
  would duplicate the thought
- fixed the Codex TOML merge corrupting configs that express the environment as
  a `[mcp_servers.think.env]` sub-table; it previously declared `env` twice and
  left the whole file invalid, breaking every server in it
- fixed MCP client config writes to be atomic, so an interrupted install cannot
  truncate live client state such as `~/.claude.json`
- fixed acceptance fixtures inheriting `THINK_` environment variables, which let
  a developer with `THINK_REPO_DIR` exported run the suite against their real
  mind and write test captures into it
- fixed the MCP capture acceptance assertion depending on wall-clock latency,
  which failed under the concurrent cold spawns of the full acceptance suite
- fixed the pre-push hook being impossible to satisfy: git exports `GIT_DIR` and
  related location variables to hooks, so tests that shelled out to git resolved
  the hook's repository instead of their own fixture and six tests failed under
  `git push` while passing under `npm run test:fast`
- fixed `--server-name` accepting arbitrary text, which let the space-separated
  form inject a whole TOML table — including a second server with its own
  `command` that the client would execute on startup — into a live Codex config;
  the name is now validated as a TOML bare key at parse time and at the exported
  render and merge boundaries
- fixed the generated MCP entry hardcoding a bare `node`, which failed to start
  for clients whose PATH has none; it now records the interpreter that ran the
  installer, and pins `cwd` for project-scoped entries so ambient recall resolves
  the intended project
- fixed a dangling config symlink being replaced by a regular file, and made
  `--print` render the complete merged config rather than only the Think entry
- fixed the CLI spending the followthrough budget once per await, so a slow
  capture could take up to twice the configured budget
- fixed the git environment scrub omitting eight variables git reports as
  repository-local, including `GIT_CONFIG`; both paths now query
  `git rev-parse --local-env-vars` instead of hand-maintaining a list
- fixed the README describing `sourceURL` as free-form when it is URL-validated;
  an invalid value rejects the whole `capture` call before the thought is saved
- corrected the documented cost of a deferred capture: the raw thought stays
  readable through `inspect`, the derived layer is skipped, and the `recent`/
  `stats` read model misreports until the next healthy capture — an earlier claim that
  `remember` still found it was drawn from one unrepeated observation and is wrong
- fixed concurrent installs silently losing entries: the read-merge-write is now
  serialised with a lock, so registering several minds in parallel keeps every
  server (30 parallel registrations previously left 25)
- fixed the installer's stale-lock reclamation recursively deleting whatever it
  found at the lock path, which silently erased a tracked file in a project
  checkout; reclamation now requires an empty installer-owned directory and
  claims it by atomic rename so two reclaimers cannot both win
- fixed `renderCodexTomlBlock` interpolating env keys raw while validating the
  server name, so an env key carrying a quote or newline produced a config no TOML
  parser would read
- fixed the installer corrupting a Codex config that defines the server inline in
  its parent table (`[mcp_servers]` plus `think = { ... }`); it appended a second
  declaration of the same key and reported success, and now refuses with an
  explanation instead
- fixed the Codex TOML structural check fabricating "unterminated string" for
  valid syntax it does not itself write — `\"` escapes and `\"\"\"` / `'''`
  multi-line strings — which the installer converted into a hard refusal of the
  user's own valid config; one string-aware scanner now backs comment stripping,
  delimiter balance and header detection, and reports only what it can prove
- fixed the Codex TOML path accepting a malformed config, appending to it, and
  reporting success; both the existing file and the merged result are now checked
  for unbalanced delimiters and duplicate tables, and the write is refused on
  failure
- fixed table headers carrying an inline comment going unrecognised, which
  appended a duplicate table and invalidated the config
- fixed control characters in paths being emitted literally into TOML strings
- fixed the environment scrub being case-sensitive, which left the acceptance
  suite redirectable into a real mind on Windows
- fixed existing-entry lookup resolving inherited `Object.prototype` members, so
  a server named `constructor` reported `updated` against an empty collection
- fixed the capture followthrough deferral not being a guarantee: the timeout was
  unref'd, so a process with nothing else pending exited instead of deferring
- added a canonical Think mind fixture stored in git-cas as
  `test-fixtures/readme-smoke-mind-v1`, archived from a real capture session, with
  `scripts/build-smoke-mind-fixture.mjs` to publish it and an acceptance test that
  restores it by tree oid, verifies its digest, and reads it back; the mind
  contains a capture whose followthrough budget expired, freezing a state that
  cannot be reproduced on demand
- wired `refs/cas/*` fetching into `npm test` via `npm run fetch:cas-fixtures`, so
  a local run and CI behave the same way; it skips the network entirely when the
  fixture trees are already present and never fails the run when they cannot be
  fetched, and those refs are now pushed so a fresh clone can restore them
- added `npm run install-mcp` plus per-client shorthands (`install-mcp:claude`,
  `:codex`, `:cursor`, `:vscode`, `:windsurf`, `:list`) that merge the Think MCP
  server into Claude Code, Codex CLI, Cursor, VS Code, and Windsurf config, with
  `--mind` routing through `THINK_REPO_DIR`, idempotent merges that preserve
  unrelated servers and config keys, and `--print` / `--json` preview modes
- added `src/mcp/install-config.js` as the pure argument-parsing, path-planning,
  and config-merging model behind the install script, covered by
  `test/ports/install-mcp-config.test.js`
- rewrote `README.md` to lead with the agent surface: the nine MCP tools and
  their contracts, per-client MCP configuration, per-agent mind isolation, and a
  copy-paste agent instruction block for `CLAUDE.md` / `AGENTS.md`
- added bounded Think read-model facts for latest/recent captures plus
  self-contained fast capture records so default `--remember`, `--recent`, and
  browse bootstrap avoid scanning `entry:*`
- added ratchet tests proving default ambient recall and explicit recall avoid
  graph queries, keyword wildcard scans, and capture-node hydration when fast
  capture records are available
- added a Hexagonal Boundary lint ratchet so product code cannot increase
  direct substrate-layout or `git-warp` runtime leakage
- removed Think-managed `git-warp` cache/checkpoint reads, doctor checks, and
  ref deletion from product runtime paths
- upgraded `@git-stunts/git-warp` to 18.2.1

## [0.7.2] - 2026-06-23

- added feature proposal packets for History product boundaries, Browse memory workbench, followthrough job queue, agent-native memory API, and evidence-bound enrichment
- improved unexpected git write failures with a permission-oriented hint for sandboxed agents that cannot write to their `~/.think/<agent>` mind repository
- marked the `think-mcp` package binary executable so local installs preserve the expected CLI entrypoint mode

## [0.7.1] - 2026-06-19

- added a Runtime Truth ratchet to `npm run lint`, including strict-limit baseline enforcement and a generic source-error guard
- added the Think-on-Echo proof seam with a model-derived GraphQL memory contract, Echo/Wesley capability probe, and pinned Think memory data model
- fixed MCP capture to return after the raw local save when post-save graph follow-through is slow, matching the CLI trapdoor behavior
- fixed graph migration commands to return a fast no-op when the graph model is already current
- tightened PR review cleanup around lint arg forwarding, runtime ratchet hardening, Echo probe cleanup, and the Think memory contract timestamp scalar
- fixed MCP tool result envelopes so structured content matches each registered output schema again
- fixed checkpoint-backed reads to use public `@git-stunts/git-warp` package exports instead of private `node_modules` internals
- fixed cached writer retries across raw capture follow-through, annotations, reflect writes, migrations, and enrichment patches
- fixed enrichment search-index invalidation and per-repo cache scoping, and counted semantic-parse receipts in enrichment results
- documented `--annotate`, `--enrich`, and `--topics` in CLI help and validated stray positional text for enrichment/topic commands
- cleaned whitespace in the infrastructure doctrine and reflect command source so diff checks pass

## [0.7.0] - 2026-04-11

- added `think --doctor` health check command — reports think directory, local repo, graph model version, entry count, and upstream reachability (with `git ls-remote` connectivity test)
- added `doctor` MCP tool exposing the same structured health checks to agents
- added sparklines to bucketed `--stats` output — capture frequency rendered as Unicode block characters (▁▂▃▄▅▆▇█), oldest-to-newest
- added sparkline field to `--json --stats` `stats.total` event for machine-readable access
- added multiple minds discovery — any directory under `~/.think/` with a git repo is a browsable mind
- added mind switcher to splash screen — Tab cycles through minds, each with a deterministic shader
- added mind switcher to browse TUI — press `m` to open a command palette of available minds
- added `discoverMinds()` and `shaderForMind()` to `src/minds.js`
- added `lsRemote()` to `src/git.js` for read-only upstream connectivity checks
- upgraded bijou packages to 4.4.0 — zero-alloc frame chrome, input validation hardening, data-viz toolkit
- consolidated `BG_TOKEN` definition into `src/browse-tui/style.js` alongside the palette
- removed dead `renderSplashView()` and `parseAnsiToSurface` import from `src/splash.js`

## [0.6.0] - 2026-04-08

- added splash screen to browse TUI — shows the Think logo (large/medium/small based on terminal size) with "Press [ Enter ]" prompt before entering browse mode
- decomposed browse TUI monolith (`src/browse-tui.js`, 1864 lines) into 14 focused modules under `src/browse-tui/` — barrel re-exports preserve the public API
- converted browse TUI rendering to bijou's surface-native pipeline (`flexSurface`, `viewportSurface`, `compositeSurface`) eliminating the `parseAnsiToSurface` roundtrip, and threaded bijou context for themed borders and overlays
- replaced raw ANSI escape codes in browse TUI with bijou semantic tokens (`ctx.semantic('accent')`, `ctx.semantic('muted')`, `ctx.ui('sectionHeader')`)
- migrated browse TUI from plain `run(app)` to bijou's `createFramedApp` for framed shell architecture with automatic chrome, help overlay, overlay management, and input routing
- defined a custom bijou theme (`thinkTheme`) mapping the warm palette (plum, cream, teal, amber, mauve, coral) to all bijou token categories (semantic, status, border, surface, ui, gradient) so frame chrome, drawers, modals, and built-in components render in Think's visual identity
- upgraded bijou to 4.2.0 — new bijou-mcp rendering server, RE-007 framed shell migration, inspector fix
- added animated shader background to splash screen with 5 effects (warp, plasma, ripple, rain, heartbeat) — random on launch, left/right arrows to cycle, shader name displayed in upper-left
- added splash-to-browse transition — shader expands outward from the brain, floods the screen, then fades to black before browse mode appears
- added splash screen chrome — version badge, FPS counter, centered copyright footer, "Press [ Enter ]" boxed prompt, fade-in animation, slow color drift
- replaced hand-rolled browse panels with bijou components — inspector for metadata, stepper for session progression
- added rich bijou-formatted output to MCP server responses — tables for stats/metrics, inspector for inspect, boxed thoughts for browse
- session boundary notices now render as floating overlay boxes instead of shifting the main content
- selected-text capture from macOS share sheet (M5)
- deferred git context enrichment until followthrough to keep the capture path fast
- pruned stale `bad-code` backlog notes for already-shipped cycle `0006` and `0007` work, and aligned changelog release wording with the current cycle-based METHOD docs
- restricted command help to explicit flag forms like `think --recent --help`, preserving positional text capture and returning a clear validation error for ambiguous `think recent --help`
- extracted shared Swift `PathSearcher` utility for macOS CLI/MCP resolver lookup and added direct resolver coverage for explicit path, repo-root, bundle, and process-directory search behavior
- refreshed `CONTRIBUTING.md` to match METHOD, current backlog/design/retro locations, and current verification/release guidance
- added capture latency benchmark via `npm run benchmark:capture` with JSON and human output, isolated temp repo, and committed baseline (~2s median warm-path)
- added `--profile` flag to capture benchmark revealing module load (~2.3s) as the dominant bottleneck — actual Think runtime operations are sub-ms
- added ThinkMCPAdapter for warm capture in the macOS menu bar app — spawns think-mcp once and reuses it, eliminating the ~2.3s cold start on every capture after the first
- added MCP auto-restart — if the child process crashes, the adapter respawns it and retries the capture transparently
- extracted named Alfred policies (`src/policies.js`) for upstream push and MCP capture timeout
- added GUIDE.md with complete user documentation, MCP configuration, and LLM advice
- added VISION.md executive synthesis
- added SECURITY.md and NOTICE
- updated BEARING.md post-release

## [0.5.0] - 2026-04-03

Fifth milestone release for `think`.

### Added

- explicit stdin ingest via `think --ingest`, preserving the normal raw-capture contract and JSON envelope
- canonical JSON parsing and JSONL output through a shared deterministic JSON port so key ordering stays stable on read-in and write-out
- local stdio MCP server via `think-mcp` / `npm run mcp`, exposing typed `capture`, `recent`, `remember`, `browse`, `inspect`, `stats`, `prompt_metrics`, and `migrate_graph` tools over the existing Think runtime
- M5 URL-capture core and menu bar app routing for `think://capture?text=...`
- real macOS app-bundle packaging path with registered `think` URL-scheme metadata via `npm run macos`
- ESLint with maximum strictness, CI workflow (GitHub Actions), and tag-triggered release workflow
- pre-commit lint gate via `scripts/hooks/pre-commit`

### Changed

- adopted System-Style JavaScript as the engineering standard
- adopted METHOD for project management with CORE, SURFACE, and REFLECT legends
- decomposed monolithic BACKLOG.md into filesystem-based METHOD backlog lanes
- migrated git hooks from `.githooks/` to `scripts/hooks/`

### Notes

- `M5` is complete
- first release under METHOD discipline

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
