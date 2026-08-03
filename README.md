<div align="center">
<img src="./docs/assets/THINK-2.svg" />
<h3>Durable memory for coding agents. Think records what your agents figure out, so the next session starts where the last one ended.</h3>
</div>

Agents forget. Context windows close, sessions end, and every hard-won conclusion — why an approach was abandoned, which constraint bit you, what the user actually wanted — evaporates. Think is a local-first, Git-backed memory your agents write to over MCP and read back the next time they land in the same repo.

**Think is not a note-taking app with an MCP bolt-on.** The capture path is a trapdoor: raw text in, immutable entry out, no embeddings and no retrieval-before-write. That's what makes it safe for an agent to call mid-task without derailing itself.

![Think demo](./docs/demo.gif)

---

## TL;DR — wire an agent in 60 seconds

```bash
git clone https://github.com/flyingrobots/think.git && cd think
npm install
npm link                                        # puts `think` and `think-mcp` on PATH

npm run install-mcp -- --client=claude-code --mind=claude
```

That writes the Think MCP server into your client's config, pointed at a private mind at `~/.think/claude`. Restart the client and your agent has nine tools — `capture`, `remember`, `recent`, `browse`, `inspect`, `stats`, `prompt_metrics`, `doctor`, `migrate_graph`.

Then paste [the agent instruction block](#4-teach-the-agent-to-use-it-well) into your `CLAUDE.md` / `AGENTS.md` so the agent knows *when* to reach for those tools. Wiring the surface is the easy half; the instructions are what make it useful.

Requires **Node.js >= 22** and **Git**.

---

## Why agents need this

- **Recall is ambient, not manual.** An agent calls `remember` with no arguments and gets back thoughts captured in *this* project — matched on git remote, git root, working directory, and branch. No query engineering, no embedding index, no vector store to keep warm. (One caveat worth knowing up front: [ambient scope follows the MCP server's working directory](#ambient-scope-follows-the-server-process).)
- **Capture never blocks the agent.** Raw text is committed locally first. Derived graph work runs as follow-through and is abandoned with a warning once it exceeds its budget — 6 seconds by default, and [configurable](#environment) — rather than holding the tool call open. Network backup is best-effort and never gates the local save.
- **Every match carries its reason.** `remember` returns `tier`, `matchKinds`, and a human-readable `reasonText` per hit. An agent can tell "this matched the current git remote" from "this happens to contain the word *think*" and weight accordingly.
- **Separate minds per agent.** Two agents sharing one memory pool will pollute each other. Each mind is an independent Git repo under `~/.think/`, selected per MCP server via `THINK_REPO_DIR`. Claude writes to `~/.think/claude`, Codex writes to `~/.think/codex`, and neither sees the other unless you point them at the same mind.
- **Git all the way down.** Your agents' memory is a Git repository on your disk. Inspectable, diffable, backup-able, and yours. No service, no account, no telemetry.

---

## The MCP surface

The server is `think` (stdio, JSON-RPC). Nine tools, all with declared output schemas so agents get `structuredContent` instead of prose to scrape.

| Tool | Purpose | Key inputs |
|---|---|---|
| `capture` | Write a raw thought. The one tool that mutates memory. | `text` **(required)**, `ingress`, `sourceApp`, `sourceURL` |
| `remember` | Recall by ambient project context or explicit query. **The main read path.** | `query`, `limit` (≤50), `brief` |
| `recent` | List newest captures, optionally text-filtered. | `count` (≤100), `query` |
| `browse` | Window around one entry: chronological + session neighbors. | `entryId` (defaults to latest) |
| `inspect` | Full metadata and derived receipts for one entry. | `entryId` **(required)** |
| `stats` | Capture counts over a time window, optionally bucketed. | `since`, `from`, `to`, `bucket` |
| `prompt_metrics` | macOS capture-panel UX telemetry. | `since`, `from`, `to`, `bucket` |
| `doctor` | Health of the local Think environment. | — |
| `migrate_graph` | Upgrade the local history model in place. | — |

### `capture`

The only write. Returns `{ status: "saved_locally", entryId, backupStatus, migration, repoBootstrapped, warnings }`.

`status` is always `saved_locally` on success — that's the contract. The raw thought is committed before anything derived is attempted. `backupStatus` is `skipped` when no `THINK_UPSTREAM_URL` is set, `pending` when the push didn't land, `backed_up` when it did.

A `warnings` entry saying follow-through deferred means the derived work exceeded its budget (6s by default, see [`THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS`](#environment)). It is **not** a failure and an agent should not retry on it — retrying duplicates the thought. What deferral actually costs is worth knowing precisely, because the surfaces disagree:

| | Sees a deferred capture? |
|---|---|
| Git history | **Yes** — the raw thought is committed. Nothing is lost. |
| `remember` | **Yes** — including explicit queries. The main read path is unaffected. |
| `recent` / `stats` | **No** — they read fast capture records written during follow-through, so they under-report until it is backfilled. |

So a deferred capture is durable and still recallable; it is only missing from the chronological and counting surfaces. Raise the budget if you see deferrals routinely — a cold repo with Git fsmonitor enabled can exceed 6 seconds on its first write.

Optional provenance is additive, but only one of the three fields is genuinely free-form:

| Field | Accepted |
|---|---|
| `ingress` | Exactly one of `url`, `shortcut`, `selected_text`, `share` |
| `sourceApp` | Free-form text |
| `sourceURL` | **A valid URL.** Validated at the MCP boundary; only `http:` and `https:` are retained |

`sourceURL` is a real constraint, not a hint. Passing an internal identifier or any non-URL string **rejects the whole `capture` call before the thought is saved** — the one way to lose a capture through provenance. If you have a source that is not a URL, put it in `sourceApp`. Agents can safely leave all three off.

### `remember`

The tool that earns its keep. Called with **no query**, it builds an ambient project scope from the current working directory and ranks matches by tier:

| Tier | Meaning | `matchKinds` |
|---|---|---|
| **3** | Same project. Matched the current git remote, git root, cwd, or branch. | `ambient_git_remote`, `ambient_git_root`, `ambient_cwd`, `ambient_git_branch`, `project_tokens_text` |
| **2** | Text mentions a project token but wasn't captured here. | `fallback_text` |
| **1** | Explicit-query result (phrase or term hit). | `query_phrase`, `query_terms` |

Scores within tier 3 are additive: git remote 100, git root 80, cwd 60, branch +10. Results sort by tier, then newest-first. **Tier 3 hits are the high-signal ones** — they were captured while working on this exact thing.

Pass `brief: true` for one-line-per-match triage; pass a `query` string to switch to explicit search and ignore ambient context entirely.

#### Ambient scope follows the server process

`remember` takes no `cwd` argument. Ambient scope is resolved from the **MCP server process's** working directory — which the client sets when it launches the server, not wherever the agent has since `cd`'d. Verify what a session actually sees by reading the `scope` object every `remember` call returns:

```json
{ "scopeKind": "ambient_project", "cwd": "/Users/you/git/think",
  "gitRemote": "git@github.com:flyingrobots/think.git", "projectName": "think" }
```

For clients that launch the server at the workspace root, this is exactly what you want. It bites in two cases: an agent working across multiple repos in one session, and a user-scope server launched from somewhere unrelated — both yield a `scope` with `gitRoot: null` and no tier-3 hits. **The fix is to pass an explicit `query`**, which skips ambient resolution entirely. The instruction block below tells the agent to do that when `scope.gitRoot` comes back `null`.

### Errors worth handling

`browse` and `inspect` refuse to read a stale history model. The error carries `code: "graph_migration_required"` and `remediation: "think --migrate-history"` — an agent seeing this should call `migrate_graph` (or surface the remediation) rather than treating it as "no memory available."

`remember` and `recent` degrade gracefully instead: they return `repoPresent: false` with an empty result set when no mind exists yet.

---

## Configure your agents

### 1. Install the MCP server

```bash
npm run install-mcp -- --client=<id> [options]
npm run install-mcp:list          # show supported clients and scopes
```

| Client | `--client` | User scope | Project scope |
|---|---|---|---|
| Claude Code | `claude-code` | `~/.claude.json` | `.mcp.json` |
| Codex CLI | `codex` | `~/.codex/config.toml` | `.codex/config.toml` |
| Cursor | `cursor` | `~/.cursor/mcp.json` | `.cursor/mcp.json` |
| VS Code (Copilot agent mode) | `vscode` | — | `.vscode/mcp.json` |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` | — |

Shorthands exist for each: `npm run install-mcp:claude`, `:codex`, `:cursor`, `:vscode`, `:windsurf`.

**Scope defaults to `user`,** because a mind is one durable archive under `~/.think` — not a per-repo artifact. Use `--scope=project --dir=PATH` when you want the wiring committed to a repo.

Useful options:

| Option | Effect |
|---|---|
| `--mind=NAME` | Route this client at `~/.think/NAME` via `THINK_REPO_DIR`. Use `default` for the shared `~/.think/repo`. |
| `--repo-dir=PATH` | Route at an explicit mind directory instead. |
| `--server-name=NAME` | Register under a different MCP server name (default `think`). |
| `--print` | Show exactly what would be written, then exit. **Run this first.** |
| `--json` | Machine-readable result. |

Writes are **merge-based and idempotent**: existing servers and unrelated config keys are preserved, a stale Think entry is replaced in place, and re-running reports `unchanged`. Preview any write before it lands:

```bash
npm run install-mcp -- --client=claude-code --mind=claude --print
```

Two things to know about user-scope writes. They touch live client config, so preview first. And JSON targets are rewritten with 2-space indentation — content is preserved key-for-key, but a hand-formatted file comes back reformatted. If you'd rather Think never wrote `~/.claude.json`, Claude Code's own CLI takes the same entry:

```bash
claude mcp add-json think --scope user \
  '{"command":"node","args":["/absolute/path/to/think/bin/think-mcp.js"],"env":{"THINK_REPO_DIR":"/Users/you/.think/claude"}}'
```

### 2. Or configure it by hand

```json
{
  "mcpServers": {
    "think": {
      "command": "node",
      "args": ["/absolute/path/to/think/bin/think-mcp.js"],
      "env": { "THINK_REPO_DIR": "/Users/you/.think/claude" }
    }
  }
}
```

Codex CLI wants TOML:

```toml
[mcp_servers.think]
command = "node"
args = ["/absolute/path/to/think/bin/think-mcp.js"]
env = { THINK_REPO_DIR = "/Users/you/.think/codex" }
startup_timeout_sec = 60
```

VS Code uses the key `servers` rather than `mcpServers`. Omit `env` entirely to use the default mind.

### 3. Give each agent its own mind

A mind is any directory under `~/.think/` containing a Git repo. The filesystem is the registry — there is no config file to update.

```bash
mkdir -p ~/.think/claude && git -C ~/.think/claude init
mkdir -p ~/.think/codex  && git -C ~/.think/codex  init
```

Then point each client at one with `--mind`. Minds are fully isolated: an agent reads and writes only the mind its `THINK_REPO_DIR` names. To let two agents share memory, point them at the same mind. To let one agent *read* another's, expose a second MCP server entry with a different `--server-name` and that mind's `--repo-dir`.

### 4. Teach the agent to use it well

MCP gives the agent capability; this gives it judgment. Paste into your `CLAUDE.md`, `AGENTS.md`, or system prompt:

```markdown
## Think — your durable memory

You have a persistent memory across sessions via the `think` MCP server.
It is not the source of truth about this repo. It is where *your*
conclusions, decisions, and dead ends live.

### Read at the start

Call `remember` with no arguments when you:
- start a session or regain context after a compaction
- change working directory into a different repo
- pick up a task you may have worked on before

Weigh the results by `tier`: **tier 3** was captured while working on
this exact project, **tier 2** merely mentions it, **tier 1** is a
keyword hit. Read `reasonText` before you trust a match.

Ambient scope comes from the MCP server's working directory, not
yours. Check the returned `scope`: if `scope.gitRoot` is `null` or
names a different repo than you are working in, ambient recall is
looking in the wrong place — call `remember` again with an explicit
`query` naming the project or topic. Also use an explicit `query`
whenever you have a specific question, and `recent` to see the last N
captures regardless of project.

### Write when a cycle closes

Call `capture` when something durable happened — not as a running log:
- a decision, **with the reasoning and the alternatives you rejected**
- an approach that failed, and why, so you don't retry it
- a non-obvious constraint you discovered the hard way
- a user preference or correction that will still matter next week

Write self-contained thoughts in full sentences. Future-you has no
context — "the timeout fix" is useless; "capture follow-through is
abandoned after 6s so a cold repo's first write still returns
saved_locally" is not.

Do **not** capture: what git log already records, what's in the code,
step-by-step narration of what you just did, or anything only relevant
to the current conversation.

### Anchor claims to evidence

Think is memory, not proof. When a captured thought makes a strong
claim, tie it to something inspectable — a file, commit, command, or
test. Prefer `<filepath>#<line>@<git-sha>`.

### Capture is cheap and non-blocking

`capture` returns `status: "saved_locally"` as soon as the raw text is
committed. A `warnings` entry about deferred follow-through means the
derived work ran out of budget. The thought is still committed and
`remember` will still find it; it just will not appear in `recent` or
`stats` until backfilled. Either way it is not an error — **do not
retry, because retrying duplicates the thought.**
```

Trim it to taste, but keep the read trigger, the write trigger, and the "self-contained thoughts" rule. Those three do most of the work.

---

## Human surfaces

Think is agent-first, not agent-only. Everything the MCP surface exposes has a CLI equivalent, and `--json` makes any of it scriptable.

```bash
think "turkey is good in burritos"        # capture
printf 'piped\n' | think --ingest         # capture stdin explicitly
think --remember --brief                  # ambient recall for the current repo
think --remember "codex config"           # explicit query
think --recent --count=20
think --browse                            # reader-first TUI
think --stats --since=7d --bucket=day
think --doctor [--fix]
think --help
```

The browse TUI is the high-fidelity re-entry point: window-based navigation, session neighbors, and `m` to switch minds. On macOS, `npm run macos` builds a menu-bar app with a global capture hotkey (`Cmd+Shift+I`).

Beyond the MCP surface, the CLI also offers `--annotate`, `--enrich`, `--topics`, and `--reflect` for pressure-testing ideas through structured prompt families.

---

## Environment

| Variable | Effect |
|---|---|
| `THINK_REPO_DIR` | Select the mind. Defaults to `~/.think/repo`. This is how per-agent namespacing works. |
| `THINK_UPSTREAM_URL` | Enable best-effort push backup. Unset means `backupStatus: "skipped"`. |
| `THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS` | Budget for post-capture derived work, in milliseconds. Defaults to `6000`. Raise it on slow or cold repositories that defer routinely. An unusable value falls back to the default rather than failing the capture. |
| `THINK_PROMPT_METRICS_FILE` | Override the prompt telemetry path. |

Verify a setup with `think --doctor`, which checks the Think directory, local repo, history model version, entry count, Git fsmonitor state, and upstream reachability.

---

## Further reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — structural reference (Git, WARP, Minds)
- [`docs/MIND_ORCHESTRATION.md`](./docs/MIND_ORCHESTRATION.md) — multi-mind mechanics
- [`docs/AMBIENT_CONTEXT.md`](./docs/AMBIENT_CONTEXT.md) — how ambient recall matching works
- [`GUIDE.md`](./GUIDE.md) — orientation and fast path
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — work doctrine

---
By [FLYING ROBOTS](https://github.com/flyingrobots)
