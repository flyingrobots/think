# AGENTS.md

Instructions for any AI agent working in this repo.

## What this repo is

Think is a local-first tool for capturing raw thoughts. It stores them in a private Git-backed WARP graph on the local machine. Read [docs/GUIDE.md](docs/GUIDE.md) for the full user guide.

## Before you start

- Read `CLAUDE.md` for build commands, test suites, and process
- Read `docs/BEARING.md` for current direction and tensions
- Read `docs/VISION.md` for the big picture
- Run `npm test` and `npm run lint` before committing anything

## Things that will bite you

- **One `swift test` at a time.** Multiple concurrent runs deadlock on the SwiftPM build lock. If tests hang, `pkill -9 -f swift-test` and retry.
- **Rebuild the macOS app after changing Swift code.** Run `npm run macos:bundle`. The tray icon's update detector watches the compiled binary, not source files.
- **The capture path is sacred.** Do not add intelligence, classification, tagging, suggestions, embeddings, or any friction to the capture moment. If you're unsure whether a change affects capture, it probably does. Ask.
- **Tests are the spec.** Never alter a failing test to make it pass. Fix the code. If you believe the test is wrong, stop and ask.
- **`--json` on everything.** Every CLI command must support `--json` for JSONL output. If you add a new command, add `--json` support.
- **ESM module loading is the bottleneck.** CLI capture takes ~2s because of cold-start module loading, not because of Think's runtime. The MCP server avoids this by being a long-running process. Don't try to optimize the capture runtime — it's already sub-ms.

## Process

Think uses METHOD. The cycle loop is: pull from backlog → design doc → RED (failing tests) → GREEN (make them pass) → playback → retro → close.

- Write failing tests first
- Commit RED and GREEN separately
- Update CHANGELOG and BEARING at cycle boundaries
- Write a retro for every cycle, even failed ones

## Coding standard

System-Style JavaScript. Runtime truth wins. Domain concepts need runtime-backed forms. Validation at boundaries. Behavior on the owning type. No shape soup.

See [docs/SYSTEMS_STYLE_JAVASCRIPT.md](docs/SYSTEMS_STYLE_JAVASCRIPT.md).

## Where things live

| What | Where |
|------|-------|
| CLI entry | `bin/think.js` |
| MCP server | `bin/think-mcp.js` |
| CLI dispatch | `src/cli.js`, `src/cli/` |
| MCP tools | `src/mcp/` |
| Storage/graph | `src/store.js`, `src/store/` |
| Git operations | `src/git.js` |
| macOS app | `macos/` |
| Acceptance tests | `test/acceptance/` |
| Benchmark tests | `test/benchmarks/` |
| Benchmarks | `benchmarks/` |
| Backlog | `docs/method/backlog/` |
| Design docs | `docs/design/<cycle>/` |
| Retros | `docs/method/retro/<cycle>/` |
| Legends | `docs/method/legends/` |
