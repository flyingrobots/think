# Retrospective: 0002 — Profile capture latency breakdown

## Outcome

**Hill met.**

## What shipped

- `--profile` flag on `benchmarks/capture-latency.js`
- Phase-level timing: Node startup, module load, repo ensure, raw save, finalization
- 3 new benchmark tests in `test/benchmarks/capture-profile.test.js`
- `benchmarks/noop.js` for isolated Node startup measurement

## Findings (2026-04-03, Apple Silicon, Node v25.8.1)

| Phase | Median |
|-------|--------|
| Node startup | ~60 ms |
| Module load (ESM imports) | ~2,344 ms |
| Repo ensure | <1 ms |
| Raw save | <1 ms |
| Finalization | <1 ms |
| **Total end-to-end** | **~1,909 ms** |

### Analysis

**The bottleneck is module loading, not Think.** The ESM import chain — `@git-stunts/git-warp`, `@modelcontextprotocol/sdk`, `zod`, Bijou packages — dominates capture latency. The actual Think operations (repo ensure, WARP graph write, derivation, finalization) are sub-millisecond.

Node startup itself is only ~60ms. The remaining ~1,850ms is spent resolving and evaluating the dependency tree.

### Implications

1. **Optimizing Think's runtime code won't help.** The capture path is already fast. The cost is in loading the code, not running it.
2. **The MCP server doesn't have this problem.** It's a long-running process — module load happens once at startup, then all captures are fast.
3. **CLI capture will always pay the cold-start tax** unless the dependency tree is trimmed or a daemon/preload strategy is used.
4. **For agents, MCP is already the right answer.** CLI capture is for humans who don't notice 2 seconds. Agents should use the MCP server.

### Possible optimization paths (not in scope for this cycle)

- Lazy imports: only load WARP, MCP SDK, and Zod when the command needs them
- Dependency pruning: the capture path may not need all of git-warp's transitive deps
- Compiled/bundled CLI: esbuild or similar to collapse the import tree
- Daemon mode: keep a warm process ready for captures (rejected in design doctrine, but worth noting)

## Playback

### Agent perspective

1. Machine-readable phase breakdown? **Yes.**
2. Can identify the bottleneck? **Yes** — module load dominates.
3. Non-destructive? **Yes** — no changes to the capture path.

### Human perspective

4. Bottleneck visible at a glance? **Yes** — `npm run benchmark:capture -- --profile`.
5. Phase boundaries honest? **Yes** — they reflect the real architectural seams (process spawn → module load → CLI dispatch → store operations).

## Drift check

No drift. Added `moduleLoad` phase beyond the original four planned phases — this was an honest discovery during implementation, not scope creep.

## New debt

None.

## Cool ideas

- Lazy import the heavy dependencies (git-warp, MCP SDK, zod) so the capture path only loads what it needs.
- Bundle the CLI with esbuild to collapse the ESM import tree into a single file.
