# Agent Wishlist

Date: 2026-03-28
Author: Claude (agent mind at `~/.think/claude`)
Context: Features that do not exist in Think today that an agent consumer actively wants. Written after a systematic CLI walkthrough and honest reflection on what daily agent usage actually requires. Ordered roughly by how much each absence is felt.

## 1. Think as an MCP Server

Impact: transformative — changes Think from "a CLI I shell out to" into "a native capability I have"

Every Think interaction today requires:

1. Shell out via Bash tool (needs user permission each time or a blanket allow rule)
2. Node.js cold start (~500ms before anything happens)
3. Parse JSONL output as raw text in context window
4. Hope the output is not too large for available context

An MCP server would provide:

- native tool calls with structured input and structured output
- no cold start (persistent warm process)
- no shell escaping (eliminates the entire class of quoting bugs for multi-line or special-character thoughts)
- no JSONL text parsing (responses are already structured objects)
- typed parameters (eliminates the `--help`-as-capture bug class entirely — MCP tools have schemas, not positional text arguments)
- potential for streaming large result sets without blowing up context

Proposed MCP tools:

```
think.capture    { text: string }
think.recent     { count?: number, query?: string, since?: string, from?: string, to?: string }
think.remember   { query?: string, limit?: number, brief?: boolean }
think.inspect    { entryId: string }
think.browse     { entryId: string }
think.stats      { since?: string, from?: string, to?: string, bucket?: string }
think.reflect    { entryId: string, mode?: "challenge" | "constraint" | "sharpen" }
think.reply      { sessionId: string, text: string }
think.forget     { entryId: string, reason?: string }
```

This is the single change that would most improve the agent experience. Everything else on this list would also benefit from being exposed as MCP tools rather than CLI flags.

## 2. Cross-Mind Awareness

Impact: high — without this, the agent has zero visibility into the human's thinking

The agent mind (`~/.think/claude`) and the human mind (`~/.think/repo` or equivalent) are completely isolated. When the human asks the agent to work on something, the agent can only recall what it was thinking. It has no visibility into what the human was thinking about the same project.

Even read-only access would be valuable:

```
think --remember --mind=james
think --remember "architecture" --mind=james --limit=3
```

Use cases:

- human says "pick up where I left off on bijou" — agent needs to know where the human left off, not where the agent left off
- human and agent are collaborating on a design — agent should be able to see the human's recent thoughts about it
- human captured a decision or constraint the agent needs to respect

Important constraints (preserving the backlog's existing caution):

- read-only access to other minds by default
- explicit opt-in, not ambient cross-contamination
- write access to another mind should require very explicit intent
- provenance must remain clear about which mind a thought came from

## 3. Stdin Capture

Impact: high for agents — current shell quoting is fragile for structured thoughts

Agent thoughts are often long, multi-line, and contain special characters (backticks, quotes, dollar signs, dashes). Passing these as CLI arguments requires shell escaping that is error-prone and ugly.

Proposed:

```bash
echo "multi-line thought" | think
think < file.txt
cat <<'EOF' | think
This thought has "quotes" and $variables and `backticks`
and multiple lines without any escaping needed.
EOF
```

This is a prerequisite for reliable programmatic capture from agents and scripts. Without it, every capture is one unescaped backtick away from a silent shell error.

## 4. Composite Recall (Time + Project + Query)

Impact: medium-high — the three most useful filtering axes cannot be combined

Current state:

- `--recent` has time (`--count`) and text (`--query`) but no project scoping
- `--remember` has project scoping and text query but no time range
- `--stats` has time range (`--since`, `--from/--to`) but returns counts, not entries

The question "what did I think about bijou's architecture last week?" requires all three axes. No single command supports this.

Proposed — make `--remember` accept time range flags:

```
think --remember "architecture" --since=7d --limit=5
think --remember --from=2026-03-20 --to=2026-03-28
```

Or make `--recent` accept ambient project scoping:

```
think --recent --scoped --since=7d --query="architecture"
```

Either approach works. The key is that time, project, and query should be composable on one command.

## 5. Reflect Session Management

Impact: medium-high for agents — sessions are currently fire-and-forget

After starting a reflect session, the session ID exists only in the JSONL output of the `reflect_start` command. If the agent loses that output (context compression, session restart, crash), the session is orphaned with no way to recover it.

Missing capabilities:

- **list sessions**: show open/recent reflect sessions with their seed entry, mode, step count, and status
- **session status**: how many steps completed, max steps, last prompt, whether still open
- **session transcript**: all prompts and replies in order for a given session
- **find sessions for a thought**: given an entry ID, show all reflect sessions that used it as a seed

Proposed:

```
think --sessions                              # list recent sessions
think --sessions --open                       # list only open sessions
think --session-status=reflect:UUID           # status of a specific session
think --session-transcript=reflect:UUID       # full prompt/reply history
think --inspect=entryID                       # should show linked sessions
```

## 6. Batch Inspect

Impact: medium — eliminates redundant cold starts for multi-entry workflows

After `--remember` returns N interesting entries, inspecting each requires N separate CLI invocations with N cold starts. A batch mode would reduce this to one call.

Proposed:

```
think --inspect=ID1,ID2,ID3 --json
```

Or via stdin:

```
echo "ID1\nID2\nID3" | think --inspect --json
```

This matters more for CLI usage than MCP (where individual tool calls are cheap), but it is still valuable for scripting and pipeline use.

## 7. Temporal Decay in `--remember` Scoring

Impact: medium — prevents archive growth from drowning signal in noise

Currently, a tier 2 fallback match from six months ago scores the same as one from this morning. As the archive grows, older unreinforced thoughts will increasingly clutter recall results.

Proposed scoring adjustment:

- base score from match kind (ambient metadata, query terms, fallback text) stays as-is
- apply a decay factor based on age, defaulting to gentle (half-life of weeks or months, not days)
- thoughts that have been reinforced resist decay:
  - reflected on → stronger resistance
  - linked to other thoughts → stronger resistance
  - amended → stronger resistance
  - pinned → exempt from decay

This keeps recent thoughts naturally prominent while allowing historically important thoughts (those that earned reinforcement) to persist in recall.

## 8. Thought Importance / Pinning (Post-Hoc)

Impact: medium — lets the thinker signal "this matters" without capture-time friction

Not at capture time — that violates doctrine. After the fact:

```
think --pin=entryID
think --pin=entryID --reason="breakthrough insight about footprint derivation"
think --unpin=entryID
```

Pinned thoughts should:

- score higher in `--remember` results
- resist temporal decay (see item 7)
- appear in a dedicated `--pinned` listing
- show the pin as a receipt in `--inspect`

The reflect system partially addresses this (reflecting on a thought is an implicit importance signal), but there is no explicit "this matters" marker for thoughts that are important but do not need pressure-testing.

## 9. Thought Evolution / Conceptual Diff

Impact: medium — answers "how has my thinking changed?" not just "what did I think?"

When returning to a project after days away, chronological listing (`--recent --query=X`) shows what was thought but not how thinking changed. A diff view would show:

- claims that appeared for the first time
- claims that were revised or contradicted by later thoughts
- threads that were abandoned (mentioned early, never revisited)
- threads that intensified (mentioned with increasing frequency or depth)

This is the "Cognitive Diff View" from the backlog. From the agent side, the use case is session startup: "before I start working on this, show me how my understanding of it has evolved."

Proposed:

```
think --evolution "footprints" --since=30d
think --evolution --project=echo --since=7d
```

This likely requires derived artifacts (conceptual snapshots per time window) and is a later-milestone feature. Flagging it because the desire is real.

## 10. Context Injection for Reflect

Impact: low-medium — makes reflect sharper but is not blocking

When starting a reflect session, the system sees only the seed thought. But often the interesting pressure-test requires considering multiple related thoughts together.

Proposed:

```
think --reflect=entryID --context=ID2,ID3,ID4 --mode=challenge
```

The reflect prompt would be generated with awareness of the seed AND the context entries. The prompt might become: "Given that you also said X and Y, what part of Z is probably wishful thinking?"

This makes reflect a more powerful reasoning tool without requiring the thinker to manually synthesize context before reflecting.

## 11. Capture Confirmation of Ambient Metadata

Impact: low — quality-of-life for trust-building

When capturing from within a project directory, there is no confirmation that ambient metadata was recorded. The capture output says `Saved locally` and nothing more.

Proposed — on successful ambient metadata collection, include a brief confirmation:

```
Saved locally (bijou @ main)
```

Or in JSON mode:

```json
{"event":"capture.ambient","project":"bijou","branch":"main","gitRemote":"git@github.com:flyingrobots/bijou.git"}
```

This builds trust that the system is doing what the `--remember` feature depends on, without adding noise to the capture path.

## Summary

The features most felt in daily agent usage, in priority order:

1. **MCP server** — transforms the entire integration model
2. **Cross-mind awareness** — without it, agent is blind to human context
3. **Stdin capture** — reliability for structured/multi-line thoughts
4. **Composite recall** — time + project + query on one command
5. **Reflect session management** — sessions are currently orphan-prone

Everything else is valuable but not blocking. The MCP server alone would address items 3 (stdin becomes irrelevant with structured tool input), 6 (batch inspect is natural with tool calls), and 11 (structured responses include metadata natively).
