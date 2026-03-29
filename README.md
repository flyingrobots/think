<div align="center">
<img alt="THINK" src="https://github.com/user-attachments/assets/55f89d75-cc49-405e-9a6e-624d24df0916" />
</div>

Capture raw thoughts instantly. Revisit them later.

`think` is a local-first tool for recording thoughts the moment they appear — before structure, before categories, before you forget. It stores everything in a private Git-backed repo on your machine and optionally backs up to a remote. Later, you can browse, remember, inspect, and pressure-test what you captured.

## Install

Requirements:

- Node.js 22+
- for the macOS menu bar app: macOS 14+ and an Xcode / Swift toolchain that supports Swift 6

```bash
git clone https://github.com/flyingrobots/think.git
cd think
npm install
node ./bin/think.js "first captured thought"
```

If you want a shell-wide `think` command while developing locally, `npm link` still works, but it is optional.

The examples below use `think`. If you skip `npm link`, run the same commands as `node ./bin/think.js ...`.

## Capture

```bash
think "turkey is good in burritos"
```

That's it. The thought is saved locally. If you've configured an upstream, it backs up automatically.

Output is intentionally boring: `Saved locally`, `Backed up`, or `Backup pending`.

## Read

```bash
think --recent                        # newest thoughts
think --recent --count=5              # last five
think --recent --query=warp           # search recent thoughts
think --remember                      # what was I thinking about this project?
think --remember "warp receipts"      # recall thoughts about a specific topic
think --remember --limit=3            # keep recall bounded
think --remember --brief --limit=5    # triage snippets before deep inspection
think --stats                         # capture counts
think --stats --since=7d --bucket=day # activity over the last week by day
think --prompt-metrics                # prompt UX counts and latency
think --prompt-metrics --since=7d     # recent prompt telemetry window
```

## Browse

```bash
think --browse=<entryId>              # view one thought with neighbors
think --browse                        # open the full-screen TUI
```

The browse TUI is reader-first: one thought fills the screen. Navigate with `j`/`k`, jump sessions with `[`/`]`, summon drawers with `s` (session) and `l` (log), search with `/`, inspect with `i`, reflect with `r`, quit with `q`. Browse uses short visible ids for ordinary orientation, while `--inspect` keeps full exact ids.

## Inspect

```bash
think --inspect=<entryId>
```

Shows exact metadata, canonical identity (`thought:<fingerprint>`), and any derived receipts — seed quality, session attribution, reflect descendants — without summarizing the thought itself.

## Reflect

Pressure-test a captured idea through structured prompts.

```bash
think --reflect                                     # pick a seed interactively
think --reflect=<entryId>                           # start from a specific thought
think --reflect=<entryId> --mode=sharpen            # choose a prompt family
think --reflect-session=<sessionId> "push further"  # continue a session
```

Reflect stores its output as derived entries, separate from raw captures.

## macOS Menu Bar App

```bash
npm run macos
```

Hit `Cmd+Shift+I` anywhere. A capture panel appears. Type, press Enter, done. The menu bar icon shows save status so the panel can vanish immediately.

## Machine-Readable Output

Every command supports `--json` for JSONL output. Data goes to `stdout`, warnings and errors to `stderr`.

```bash
think --json "capture this"
think --json --recent
think --json --browse=<entryId>
think --json --inspect=<entryId>
think --json --stats --bucket=day
think --json --prompt-metrics --bucket=day
think --json --reflect=<entryId>
```

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `THINK_REPO_DIR` | Local thought repo path | `~/.think/repo` |
| `THINK_UPSTREAM_URL` | Git remote for backup | _(none)_ |
| `THINK_PROMPT_METRICS_FILE` | macOS telemetry output path | `~/.think/metrics/prompt-ux.jsonl` |

## Graph Migration

When the internal graph model evolves, read commands may require a one-time migration:

```bash
think --migrate-graph
```

Raw capture always works regardless of graph version — it saves first, migrates after.
Current graph-native read behavior targets graph model `v3`.
Interactive human upgrades now show a visible progress state and then continue automatically into the requested command.

## Tests

Tests are the spec. Design docs define intent, executable tests define the contract.

```bash
npm test              # acceptance suite (Node.js)
npm run test:local    # acceptance + macOS Swift tests
npm run test:benchmarks
```

## Development

```bash
npm run install-hooks             # enable pre-push hook
npm run benchmark:browse          # browse bootstrap benchmark
```

The committed synthetic browse benchmark currently improved from a `4152 ms` median `BEFORE` baseline to a `346 ms` median `AFTER` baseline.

For contributors, the current system references are:

- [docs/ARCHITECTURE.md](/Users/james/git/think/docs/ARCHITECTURE.md)
- [docs/GLOSSARY.md](/Users/james/git/think/docs/GLOSSARY.md)
- [docs/design/ROADMAP.md](/Users/james/git/think/docs/design/ROADMAP.md)

## Project Structure

- `bin/think.js` — CLI entrypoint
- `src/cli.js` and `src/cli/` — CLI entry, parsing, dispatch, and command runners
- `src/store.js` and `src/store/` — thought storage, graph reads, derivation, and migration logic
- `src/git.js` — Git operations
- `macos/` — native macOS menu bar app (Swift)
- `test/acceptance/` — acceptance specs
- `docs/design/` — design documents and roadmap

## Design Principles

- Raw capture is sacred and immutable
- Capture must be cheap — if it feels like "using a system," it's already wrong
- Local-first, always — local save never depends on network
- Interpretation comes later, never during capture
- Less structure, lower latency, fewer fields
- The agent-facing JSONL contract is a real product boundary

## License

Apache License 2.0. See [LICENSE](LICENSE).
