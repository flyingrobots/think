# Guide

This is the complete user guide for `think`.

Use it when you want to capture thoughts, browse your archive, recall context, pressure-test ideas, or wire Think into an agent workflow.

- If you want a quick overview, start with the [README](../README.md).
- If you want to contribute, read [CONTRIBUTING.md](../CONTRIBUTING.md).
- If you want architecture internals, read [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Install

### Requirements

- Node.js 22+
- Git (Think uses Git for storage and backup)
- For the macOS menu bar app: macOS 14+ and Swift 6

### Clone and install

```bash
git clone https://github.com/flyingrobots/think.git
cd think
npm install
```

### First capture

```bash
node ./bin/think.js "my first thought"
```

Think auto-bootstraps a local repo at `~/.think/repo` on the first capture. No setup required.

### Shell-wide command

If you want `think` available everywhere:

```bash
npm link
```

Then you can use `think` directly instead of `node ./bin/think.js`. All examples in this guide use `think`.

### Agent wrapper

To give an LLM agent its own isolated thought repo:

```bash
cat > ~/.local/bin/agent-think << 'EOF'
#!/usr/bin/env bash
export THINK_REPO_DIR="$HOME/.think/agent"
exec node "$HOME/git/think/bin/think.js" "$@"
EOF
chmod +x ~/.local/bin/agent-think
```

This keeps the agent's thoughts separate from yours. Each agent can have its own `THINK_REPO_DIR`.

---

## Capture

Capture is the core of Think. It is intentionally cheap, fast, and boring.

### Direct capture

```bash
think "turkey is good in burritos"
```

The thought is saved exactly as written. No parsing, no tagging, no classification. Output is one of:

- `Saved locally` — stored in the local repo
- `Backed up` — stored locally and pushed to the upstream remote
- `Backup pending` — stored locally, upstream push failed (will retry next time)

### Stdin capture

```bash
echo "piped thought" | think --ingest
```

`--ingest` explicitly captures stdin. Without `--ingest`, piped input is ignored — this prevents accidental captures when Think is part of a pipeline.

### What gets stored

Every capture records:

- The exact raw text (immutable after write)
- A timestamp
- A canonical content fingerprint (`thought:<sha256>`)
- Ambient context: working directory, git root, git remote, git branch
- Writer identity and session attribution

You never see most of this during capture. It powers recall and browse later.

### What does not happen during capture

- No embeddings
- No clustering
- No tagging or classification
- No suggestions or prompts
- No retrieval-before-write

This is by design. Capture is a trapdoor, not a workflow.

---

## Read

### Recent

List your newest captures, newest first.

```bash
think --recent
think --recent --count=5
think --recent --query="warp"
```

| Flag | Purpose |
|------|---------|
| `--count=N` | Limit to the newest N entries |
| `--query=TEXT` | Case-insensitive text filter |

`recent` is deliberately boring. It does not summarize, cluster, or rank. It shows what you captured, in order.

### Remember

Context-aware recall. Think scores your past captures against your current project.

```bash
think --remember                        # ambient recall (uses cwd + git context)
think --remember "warp performance"     # explicit query
think --remember --limit=3              # bounded results
think --remember --brief                # one-line triage snippets
think --remember --brief --limit=5      # triage before deep inspection
```

| Flag | Purpose |
|------|---------|
| `--limit=N` | Return at most N matches |
| `--brief` | One-line snippet per match instead of full text |

**Ambient mode** (no query): Think reads your current working directory, git remote, and branch. It scores captures by project match, directory match, and text token overlap. This is how agents reconstruct prior context at session startup.

**Explicit mode** (with query): Full-text search across all captures, scored by term frequency.

Both modes return receipts explaining why each match was returned.

### Stats

Capture counts with optional time filters and bucketing.

```bash
think --stats
think --stats --since=7d
think --stats --since=30d --bucket=day
think --stats --from=2026-03-01 --to=2026-03-31
think --stats --bucket=week
```

| Flag | Purpose |
|------|---------|
| `--since=DURATION` | Relative window: `24h`, `7d`, `2w` |
| `--from=DATE` | Absolute lower bound (ISO date or timestamp) |
| `--to=DATE` | Absolute upper bound |
| `--bucket=PERIOD` | Group by `hour`, `day`, or `week` |

### Prompt metrics

Read macOS capture panel telemetry — session counts, timing, and abandonment rates.

```bash
think --prompt-metrics
think --prompt-metrics --since=7d
think --prompt-metrics --bucket=day
```

Accepts the same time filter flags as `--stats`. Only useful if you use the macOS menu bar app.

---

## Browse

Navigate your archive one thought at a time.

### Entry-specific browse

```bash
think --browse=<entryId>
```

Returns the thought with its immediate older and newer chronological neighbors, session context, and session-nearby entries.

### Interactive TUI

```bash
think --browse
```

Opens a full-screen terminal reader. One thought fills the screen.

| Key | Action |
|-----|--------|
| `j` / `↓` | Older thought |
| `k` / `↑` | Newer thought |
| `[` | Previous thought in current session |
| `]` | Next thought in current session |
| `l` | Toggle chronology drawer |
| `s` | Toggle session drawer |
| `/` | Jump to a thought (fuzzy search) |
| `i` | Toggle inspect receipts |
| `r` | Reflect on the current thought |
| `q` | Quit |

The TUI uses short visible entry IDs for orientation. Full exact IDs are available through inspect.

---

## Inspect

Show exact metadata and derived receipts for a single capture.

```bash
think --inspect=<entryId>
```

Inspect reveals:

- Raw entry metadata (timestamp, writer, ambient context)
- Canonical thought identity (`thought:<sha256>`)
- Derived receipts: seed quality, session attribution, reflect descendants
- Full exact entry and thought IDs

Inspect does not summarize the thought. It shows what the system knows about it.

---

## Reflect

Pressure-test a captured idea through structured deterministic prompts.

### Start a session

```bash
think --reflect                           # pick a seed interactively (TTY only)
think --reflect=<entryId>                 # start from a specific thought
think --reflect=<entryId> --mode=sharpen  # choose a prompt family
```

| Mode | Purpose |
|------|---------|
| `challenge` | Surface assumptions, test robustness (default) |
| `constraint` | Explore limitations, minimize scope |
| `sharpen` | Clarify core claims, identify next moves |

### Continue a session

```bash
think --reflect-session=<sessionId> "your response"
```

### What reflect does

- Generates a deterministic seed-first prompt based on the captured thought
- Stores your response as a derived entry with preserved lineage
- Refuses low-signal status or narrative seeds that aren't pressure-testable

Reflect is entered deliberately. It never ambushes plain capture.

---

## Machine-readable output

Every command supports `--json` for JSONL output. Data goes to `stdout`, warnings and errors to `stderr`.

```bash
think --json "capture this"
think --json --recent
think --json --remember "query"
think --json --browse=<entryId>
think --json --inspect=<entryId>
think --json --stats --bucket=day
think --json --prompt-metrics
think --json --reflect=<entryId>
think --json --reflect-session=<sessionId> "response"
printf "stdin thought\n" | think --json --ingest
```

### Output conventions

- Each line is a self-contained JSON object
- Keys are sorted deterministically
- `stdout` carries data events (entries, matches, stats rows)
- `stderr` carries warnings, errors, and trace events
- `--verbose` adds detailed JSONL trace events to `stderr`

### Common event types

| Event | Where | Meaning |
|-------|-------|---------|
| `cli.start` | stderr | Command began |
| `cli.success` | stderr | Command completed |
| `cli.error` | stderr | Command failed |
| `capture.local_save.done` | stderr | Thought saved locally |
| `recent.entry` | stdout | One recent capture |
| `browse.current` | stdout | The browsed thought |
| `browse.older` / `browse.newer` | stdout | Chronological neighbors |
| `remember.match` | stdout | One recall match with receipts |
| `stats.total` | stdout | Total capture count |
| `stats.bucket` | stdout | One time-bucketed count |

---

## MCP server

Think ships a local stdio MCP (Model Context Protocol) server so agents can use the same capture and read core without shelling out through the CLI.

### Starting the server

```bash
node ./bin/think-mcp.js
# or
npm run mcp
```

The server communicates over stdin/stdout using the MCP protocol. It does not open network ports.

### Configuring in Claude Code

Add to your MCP server configuration:

```json
{
  "mcpServers": {
    "think": {
      "command": "node",
      "args": ["/path/to/think/bin/think-mcp.js"],
      "env": {
        "THINK_REPO_DIR": "/path/to/.think/agent"
      }
    }
  }
}
```

Set `THINK_REPO_DIR` to give the agent its own isolated thought repo.

### Configuring in other MCP clients

Any MCP client that supports stdio transport can connect. The server name is `think` and the version matches `package.json`.

```json
{
  "command": "node",
  "args": ["/absolute/path/to/think/bin/think-mcp.js"],
  "env": {
    "THINK_REPO_DIR": "/absolute/path/to/.think/agent-name"
  }
}
```

### Available tools

#### `capture`

Save a thought.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | yes | The raw thought text to capture |

Returns: `entryId`, `status`, `backupStatus`, `repoBootstrapped`, `migration`, `warnings`

#### `recent`

List recent captures.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `count` | number | no | Maximum entries (1–100) |
| `query` | string | no | Case-insensitive text filter |

Returns: `entries[]` (entryId, text, createdAt, sortKey, sessionId), `repoPresent`

#### `remember`

Recall relevant thoughts by project context or query.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Explicit query. Omit for ambient project recall |
| `limit` | number | no | Maximum matches (1–50) |
| `brief` | boolean | no | One-line triage format |

Returns: `matches[]`, `scope`, `repoPresent`

#### `browse`

Return a browse window for one thought with chronological and session neighbors.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entryId` | string | no | Entry to browse. Omit for latest capture |

Returns: `current`, `older`, `newer`, `sessionContext`, `sessionEntries[]`, `sessionSteps[]`

#### `inspect`

Inspect metadata and derived receipts for one capture.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entryId` | string | yes | The entry to inspect |

Returns: `entry` (full metadata, canonical identity, derived receipts)

#### `stats`

Capture count summaries with optional filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` | string | no | Relative window (`24h`, `7d`, `2w`) |
| `from` | string | no | ISO date/timestamp lower bound |
| `to` | string | no | ISO date/timestamp upper bound |
| `bucket` | string | no | `hour`, `day`, or `week` |

Returns: `total`, `buckets[]`, `repoPresent`

#### `prompt_metrics`

macOS capture panel telemetry.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` | string | no | Relative window |
| `from` | string | no | ISO lower bound |
| `to` | string | no | ISO upper bound |
| `bucket` | string | no | `hour`, `day`, or `week` |

Returns: `summary`, `timings[]`, `buckets[]`

#### `migrate_graph`

Upgrade the local graph model in place.

No parameters.

Returns: `changed`, `graphModelVersion`, `edgesAdded`, `edgesRemoved`, `metadataUpdated`

---

## Advice for LLMs

Think is designed for both human and agent use. If you are an LLM agent using Think through the CLI or MCP, here is how to get the most out of it.

### Session startup

At the start of each conversation, recall prior context:

```bash
think --remember --json
```

Or via MCP: call `remember` with no query. This returns thoughts scored by ambient project context — your working directory, git remote, and branch are used to find relevant prior captures.

### Capturing thoughts

Use Think to externalize observations, decisions, and lessons learned. Capture is cheap — use it freely.

```bash
think "the migration controller pattern works well for sequential extraction" --json
```

Or via MCP: call `capture` with the thought text.

Good things to capture:

- Observations about the codebase that won't survive context compression
- Design decisions and why they were made
- Surprising discoveries or unexpected behavior
- Hard-won lessons from debugging sessions
- Interesting patterns worth revisiting

Do not overthink what to capture. Raw is better than polished. Capture first, revisit later.

### Browsing and inspecting

To understand a specific thought in context:

```bash
think --json --browse=<entryId>     # see neighbors and session context
think --json --inspect=<entryId>    # see metadata and derived receipts
```

Or via MCP: call `browse` or `inspect` with the entry ID.

### Reflecting

To pressure-test an idea:

```bash
think --json --reflect=<entryId>
think --json --reflect-session=<sessionId> "response"
```

Or via MCP: reflection is not yet available through MCP tools. Use the CLI.

### Key conventions

- Always pass `--json` when using the CLI programmatically. This gives you JSONL on stdout and keeps stderr for errors.
- Entry IDs look like `entry:1775233979182-cca5640c-d887-44be-adc8-2e7648a4eb2d`. They are stable and permanent.
- Session IDs look like `session:...`. They group related captures.
- Thought IDs look like `thought:<sha256>`. They are content-addressed — duplicate text produces the same thought ID.
- The `remember` tool with no query is the fastest way to reconstruct project context.

### Provenance isolation

If you are an agent, use a separate `THINK_REPO_DIR` so your thoughts don't mix with the human's archive. The wrapper script pattern (shown in Install above) makes this easy.

---

## macOS menu bar app

### Building

```bash
npm run macos          # build app bundle and open it
npm run macos:dev      # swift run for development
npm run macos:bundle   # build without opening
```

`npm run macos` creates a real `.app` bundle so macOS can register the `think://` URL scheme.

### Usage

- `Cmd+Shift+I` — open the capture panel from anywhere
- Type your thought, press Enter
- The panel vanishes immediately; the menu bar icon shows save status

### URL scheme

```
think://capture?text=Hello%20world
think://capture?text=Hello&ingress=shortcut&provenance=Safari
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text` | yes | URL-encoded thought text |
| `ingress` | no | Source identifier (defaults to `url`) |
| `provenance` | no | Additional origin context |

---

## Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `THINK_REPO_DIR` | Local thought repo path | `~/.think/repo` |
| `THINK_UPSTREAM_URL` | Git remote URL for backup | _(none — local only)_ |
| `THINK_PROMPT_METRICS_FILE` | macOS telemetry output path | `~/.think/metrics/prompt-ux.jsonl` |

### Upstream backup

To enable automatic backup after each capture:

```bash
export THINK_UPSTREAM_URL=git@github.com:you/think-backup.git
```

The remote repo must exist and be accessible. Think pushes WARP refs after each successful local save. If the push fails, the thought is still saved locally and marked as `Backup pending`.

### Custom repo location

```bash
export THINK_REPO_DIR=/path/to/custom/repo
```

The repo auto-bootstraps on first capture. This is how agent wrappers isolate their thought repos.

---

## Graph migration

Think's internal graph model evolves across versions. When a new version introduces structural changes to browse, inspect, or reflect edges, a one-time migration is required.

```bash
think --migrate-graph
```

Key behaviors:

- Raw capture always works regardless of graph version — it saves first, migrates after
- Read commands (browse, inspect, remember) on an outdated graph will prompt for migration
- In `--json` mode, outdated graphs emit a `graph.migration_required` error
- Migrations are additive and idempotent — safe to rerun
- Current target: graph model `v3`

---

## CLI reference

### Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| Capture | `think "text"` | Save a thought |
| Ingest | `think --ingest` | Capture from stdin |
| Recent | `think --recent` | List newest captures |
| Remember | `think --remember` | Context-aware recall |
| Stats | `think --stats` | Capture counts |
| Prompt metrics | `think --prompt-metrics` | macOS telemetry |
| Browse | `think --browse[=ID]` | Navigate one thought |
| Inspect | `think --inspect=ID` | Metadata and receipts |
| Reflect | `think --reflect[=ID]` | Pressure-test an idea |
| Reflect reply | `think --reflect-session=ID "text"` | Continue a session |
| Migrate | `think --migrate-graph` | Upgrade graph model |

### Global flags

| Flag | Description |
|------|-------------|
| `--json` | JSONL output (data on stdout, errors on stderr) |
| `--verbose` | Detailed JSONL trace events on stderr |

### Command-specific flags

| Flag | Applies to | Description |
|------|-----------|-------------|
| `--count=N` | `--recent` | Limit results |
| `--query=TEXT` | `--recent` | Text filter |
| `--limit=N` | `--remember` | Maximum matches |
| `--brief` | `--remember` | One-line snippets |
| `--mode=TYPE` | `--reflect` | `challenge`, `constraint`, or `sharpen` |
| `--since=DURATION` | `--stats`, `--prompt-metrics` | Relative window (`24h`, `7d`, `2w`) |
| `--from=DATE` | `--stats`, `--prompt-metrics` | Absolute lower bound |
| `--to=DATE` | `--stats`, `--prompt-metrics` | Absolute upper bound |
| `--bucket=PERIOD` | `--stats`, `--prompt-metrics` | `hour`, `day`, or `week` |
