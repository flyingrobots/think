# CLAUDE.md

Project-level instructions for Claude Code in the Think repo.

## Process

Think uses [METHOD](https://github.com/flyingrobots/method). Work flows through the cycle loop: pull → design → RED → GREEN → playback → retro → close.

- Backlog lives in `docs/method/backlog/` (lanes: inbox, asap, up-next, cool-ideas, bad-code)
- Design docs live in `docs/design/<cycle>/`
- Retrospectives live in `docs/method/retro/<cycle>/`
- Legends: **CORE**, **SURFACE**, **REFLECT** (see `docs/method/legends/`)
- Update `BEARING.md` and `CHANGELOG.md` at cycle boundaries

## Build and test

```bash
npm test                  # Node.js acceptance suite (106 tests)
npm run test:m2           # macOS Swift tests (43 tests) — Darwin only
npm run test:local        # both suites
npm run test:benchmarks   # benchmark tests
npm run lint              # ESLint
npm run benchmark:capture # capture latency benchmark
npm run benchmark:browse  # browse bootstrap benchmark
```

- Only run one `swift test` at a time. Multiple concurrent runs deadlock on the SwiftPM build lock.
- After changing Swift source files, rebuild the macOS app: `npm run macos:bundle`

## Hooks

Git hooks live in `scripts/hooks/`. Configure with:

```bash
npm run install-hooks
```

- `pre-commit`: lint must pass
- `pre-push`: tests must pass when pushing to main; feature branches skip

## Coding standard

[System-Style JavaScript](docs/SYSTEMS_STYLE_JAVASCRIPT.md) governs new code. Runtime-backed domain modeling, boundary validation, hexagonal architecture.

## Release

Tag-triggered via GitHub Actions. To release:

1. Bump version in `package.json`
2. Date the CHANGELOG section
3. Commit, tag (`v0.X.Y`), push with `--tags`

## Key architecture notes

- The capture path is sacred — no intelligence, no classification, no friction
- Every CLI command supports `--json` for JSONL output
- MCP server (`bin/think-mcp.js`) exposes the same capture/read core as the CLI
- macOS app uses `ThinkMCPAdapter` (persistent warm process) with CLI fallback
- The capture latency bottleneck is ESM module loading (~2.3s), not Think's runtime
