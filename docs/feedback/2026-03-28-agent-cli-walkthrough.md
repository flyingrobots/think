# Agent CLI Walkthrough Feedback

Date: 2026-03-28
Author: Claude (agent mind at `~/.think/claude`)
Context: Systematic walkthrough of every Think CLI command during a dogfooding session with James. All commands tested with `--json` flag. Agent wrapper at `~/.local/bin/claude-think` pointing at `~/git/think/bin/think.js`.

## Commands Tested

| Command | Tested | Working |
|---------|--------|---------|
| capture (default) | yes | yes |
| `--recent` | yes | yes |
| `--recent --count=N` | yes | yes |
| `--recent --query=TERM` | yes | yes |
| `--remember` | yes | yes |
| `--inspect=ID` | yes | yes |
| `--stats` | yes | yes |
| `--stats --since --bucket` | yes | yes |
| `--reflect=ID --mode=MODE` | yes | yes |
| `--reflect-session=ID "reply"` | yes | yes |
| `--browse=ID --json` | yes | yes |
| `--browse` (no ID, TTY) | no | — |
| `--migrate-graph` | no | — |
| `--reflect --mode=constraint` | yes | yes |
| `--reflect --mode=sharpen` | yes | yes |
| `--remember "query"` | yes | yes (see bug #7) |
| capture with `--` separator | yes | yes (see note #8) |
| `--verbose` | yes | no visible effect |

`--browse` without an ID was skipped because the agent runs in a non-interactive pipe, not a TTY. `--migrate-graph` was skipped to avoid side effects. `--browse=ID --json` works as a non-interactive agent-friendly read surface.

## Bugs and Sharp Edges

### 1. `--help` silently captures "help" as a thought

Severity: high — worst possible first impression

When running `claude-think --help`, the CLI returns `Unknown option: --help`. When running `claude-think help`, the word "help" is captured as a raw thought. Both are wrong.

Expected behavior: any of `--help`, `-h`, or bare `help` should print a usage summary and exit without side effects.

Current behavior: `--help` errors, `help` creates an irrecoverable entry in the append-only archive.

This is especially bad for agents because an agent's first instinct when encountering an unfamiliar CLI is to try `--help`. If the agent has been told "raw capture is sacred" and then discovers it accidentally polluted the archive on its first interaction, trust is damaged.

### 2. `--verbose` is a no-op on capture

Severity: medium — the flag is accepted but produces no additional output

When capturing with `--verbose --json`, the JSONL output is identical to a non-verbose capture. No additional events, no ambient metadata confirmation, nothing.

Expected behavior: `--verbose` on capture should surface the ambient metadata bundle that was recorded (or explicitly note that none was available). Example additional event:

```json
{"event":"capture.ambient","cwd":"/Users/james/git/bijou","gitRoot":"/Users/james/git/bijou","gitRemote":"git@github.com:flyingrobots/bijou.git","gitBranch":"main"}
```

This matters because the thinker currently has no confirmation that ambient context was attached. The only way to verify is to `--inspect` after the fact or run `--remember` and check the match kinds. That is too indirect for a system that values receipts.

### 3. Ambient metadata absent from `--inspect` output

Severity: medium — inspect is the explicit machinery view but omits recorded ambient context

A thought captured from `~/git/bijou` and later recalled via `--remember` shows score 265 with `ambient_git_remote`, `ambient_git_root`, `ambient_cwd`, `ambient_git_branch` match kinds. This proves the metadata was recorded at capture time.

But `--inspect` on the same entry does not expose this metadata anywhere in its output. The inspect response includes `canonicalThought`, `seedQuality`, `sessionAttribution`, and `derivedReceipts` — but no ambient context receipt.

Expected behavior: inspect should include the ambient metadata bundle as either a dedicated receipt kind or a section of the entry payload. If the entry has no ambient metadata (pre-remember captures), the field should be absent or explicitly null — not silently omitted.

## Missing Features

### 4. No `--forget` or tombstone mechanism

The accidental "help" capture is now permanently in the archive. There is no way to mark an entry as forgotten, hidden, or excluded from read surfaces.

This does not need to violate append-only doctrine. A tombstone model works:

- the original entry remains in the graph with full provenance
- a `tombstone` artifact is derived against it, marking it as forgotten
- all read surfaces (`--recent`, `--remember`, `--browse`, `--stats`) exclude tombstoned entries by default
- `--inspect` on a tombstoned entry still works and shows both the original content and the tombstone receipt

This preserves immutability while giving the thinker a way to say "this was a mistake." Without it, any accidental capture (typos, misfires, `help`) permanently clutters the archive.

Possible shape:

```
think --forget=entry:1774717299738-94672e73-4e69-44d4-a367-9937ef25523f
think --forget=entry:ID --reason="accidental capture"
```

### 5. No `--help` or usage output

The CLI has 8+ commands with numerous flags, deprecated flag mappings, and validation rules. There is no built-in discoverability.

Minimum viable help:

```
Usage: think [options] [text...]

Commands:
  think "text"                   Capture a thought (default)
  think --recent                 List recent thoughts
  think --remember [query]       Context-scoped recall
  think --browse [entryId]       Browse thoughts (interactive)
  think --inspect=ID             Show thought metadata and receipts
  think --stats                  Capture statistics
  think --reflect[=ID]           Start a reflect session
  think --reflect-session=ID     Continue a reflect session

Flags:
  --json       Machine-readable JSONL output
  --verbose    Show additional detail
  --count=N    Limit results (with --recent)
  --query=TERM Filter by term (with --recent)
  --mode=TYPE  Reflect prompt family: challenge, constraint, sharpen
  --since=DUR  Time range for stats (e.g., 7d, 2w)
  --bucket=PER Aggregation period: hour, day, week
  --from=DATE  Start date for stats (ISO 8601)
  --to=DATE    End date for stats (ISO 8601)
```

### 6. No `--forget` for the `--remember` scoping test entry concern

Related to item 4 but distinct: there is currently no negative signal mechanism for `--remember`. If a thought matches a project via ambient metadata but is actually irrelevant (e.g., it mentions the project name in a different context), there is no way to suppress it from future recall for that project.

A tombstone would handle complete removal. A lighter mechanism — something like "this thought is not about project X" — would handle the more common case of false-positive scoping without removing the thought entirely.

This is a future concern, not an immediate need. Flagging it because the `--remember` scoring system will need to handle this as archives grow.

### 7. `--remember "query"` results not sorted by score

Severity: medium — best matches buried in the middle of results

When running `think --remember "footprints parallel execution"`, results are returned with scores ranging from 1 to 3 (based on how many query terms matched). But the results are not sorted by score descending.

Observed: the bijou deep dive (score 1, matched only "execution" in passing) appears at index 0, while the Echo footprints deep dive (score 3, matched all three terms, and the thought is entirely about the query topic) appears at index 5 and index 8.

Expected: entries matching all three query terms should rank above entries matching only one. Within the same score, the existing tiebreakers (newer first) are fine.

This matters because an agent using `--remember` with a query wants the most relevant results first. If the caller adds `--limit=3` (per the 0023 proposal), they would get three score-1 results and miss the score-3 entries entirely.

### 8. `--` separator works but has a gotcha

The `--` flag correctly stops flag parsing. `think -- --this-is-not-a-flag --json` captures `--this-is-not-a-flag --json` as thought text. This is correct POSIX behavior.

The gotcha: `--json` after `--` becomes thought text, not a flag. The workaround is `think --json -- --thought-starting-with-dashes`. This is standard CLI behavior and not a bug, but it is worth documenting in `--help` output since agents will encounter this when capturing thoughts about CLI flags.

## Additional Observations From Second Pass

### `--browse=ID --json` is a clean agent navigation surface

Browse with an explicit entry ID and `--json` returns:

- `role: "current"` — the requested thought
- `role: "newer"` — the next thought chronologically
- `role: "older"` — the previous thought chronologically
- `browse.context` — session attribution with position info

This is a navigable window. An agent can walk the entire archive by following older/newer entry IDs. The design is agent-friendly without requiring the TUI.

### All three reflect modes produce good prompts

Tested against the same thought (Echo's parallel execution model):

- **challenge**: "What part of this is probably wishful thinking?"
- **constraint**: "What if this had to be explained in one sentence?"
- **sharpen**: "What should be cut from this idea?"

All three are relevant, non-generic, and would push the thinker's reasoning forward. The prompt selection feels curated rather than random.

### Reflect sessions are orphan-prone

After starting a reflect session, the only reference to the session ID is in the JSONL output of the `reflect_start` command. If the agent loses that output (context compression, session restart, crash), the session ID is gone and the session is effectively orphaned.

Missing capabilities:

- `--reflect-list` or `--sessions` — list open/recent reflect sessions
- session status (steps completed / max steps, last prompt, whether it is still open)
- session transcript (all prompts and replies in order)
- discovery of sessions associated with a specific thought

Without these, reflect sessions are fire-and-forget from the agent's perspective.

## Feature Requests From Usage

### Stdin capture

For agents writing long or multi-line thoughts, shell quoting is awkward. Support `echo "long thought" | think` or `think < file.txt`. This would make programmatic capture from scripts and pipelines natural.

### Thought linking outside reflect

A lightweight mechanism to say "this thought relates to that one" without starting a reflect session:

```
think "new thought" --relates-to=entryID
think --link=entryA,entryB
```

The graph model supports edges. This would let the thinker build structure post-hoc without classification at capture time and without the overhead of a reflect session.

### Thought amendment

Not editing the original (immutability preserved), but appending a correction that links back:

```
think "Actually, the max score is 300" --amends=entryID
```

The original stays sacred. The amendment is a new entry with provenance pointing at what it corrects. Read surfaces could show amendments alongside the original.

### Time-range filtering on `--recent`

`--stats` has `--since` and `--from/--to`, but `--recent` only has `--count` and `--query`. There is no way to ask "show me what I thought yesterday" without dumping everything and filtering client-side. Adding `--since` and `--from/--to` to `--recent` would close this gap.

### Daily digest view

A "what did I think about today?" view that returns today's entries as a bounded list. `--recent` is chronological but not date-bounded. `--stats --since=1d` gives the count but not the entries. The gap between them is the actual list.

This could be `--recent --since=1d` if time-range filtering is added to `--recent`, making it composable rather than requiring a new command.

## Ergonomic Observations

### Capture latency

Capture takes approximately 2-4 seconds end-to-end (measured from `cli.start` to `cli.success` timestamps in JSONL output). The hot path appears to run derivation synchronously — seed quality assessment and session attribution both produce artifacts before the CLI exits.

The design docs emphasize "capture must be cheap." For interactive human use (menu bar hotkey), 2-4 seconds is acceptable. For an agent capturing many thoughts in a session, it adds up. If derivation could be deferred (write the raw entry immediately, derive asynchronously), the capture path could be sub-second.

This is not a bug — the current latency is fine for the product's current stage. Flagging it as a future optimization target.

### Session bucketing works naturally

The 5-minute idle-gap threshold correctly bucketed rapid test captures into the same session and isolated the earlier `--remember` test capture into its own session. The `temporal_proximity` reason text is clear. No complaints.

### Seed quality heuristic is impressively honest

The heuristic correctly assessed:

- "Testing remember scoping: this thought is being captured from within the bijou repo..." → `likely_reflectable` (proposal/question markers detected)
- "Verbose capture test from bijou directory" → `weak_note` (status-like note)

That discrimination is correct. The first thought contains testable claims ("this should match strongly"). The second is a throwaway label. The fact that the system catches this without an LLM is a strong signal that the deterministic derivation approach is working.

### Reflect prompts are genuinely sharp

The `challenge` mode prompt for the remember-scoping thought was: "What part of this is probably wishful thinking?"

That is a good question for that thought. It is not generic. It is not sycophantic. It pushed me to identify the actual weak assumption (ambient metadata alone may not discriminate between related projects in the same constellation). The reflect system earns its place.

### JSONL contract is agent-ready

Every command produces well-structured JSONL with:

- consistent `ts` timestamps on every event
- typed `event` names that allow reliable parsing
- `cli.start` and `cli.success` / `cli.error` bookends
- structured payloads per event type
- explicit `exitCode` on completion

An agent can consume this without any screen-scraping, ANSI parsing, or heuristic extraction. The 0008 design goal ("no meaningful read behavior may exist only in the human presentation") is delivered.

## What Is Great

To be explicit about what should not change:

1. **The receipt philosophy.** Every derived artifact explains itself. Seed quality tells you why it scored the thought. Session attribution tells you why it bucketed where it did. Remember tells you why each match was returned. This is the right foundation.

2. **The append-only capture model.** Even though I want `--forget`, I understand why capture is sacred. The tombstone proposal preserves both values.

3. **The reflect session flow.** Start → prompt → reply → save-as-entry is clean and the provenance chain (seed → session → reflection entry) is explicit.

4. **The deprecated flag mapping.** Old flags produce helpful error messages pointing to the replacement. That is respectful to users who learned the old interface.

5. **The seed quality / session attribution derivation pipeline.** Running deterministic analysis at capture time and storing the results as inspectable artifacts is the right trade. It makes every read surface richer without requiring the read surface to recompute anything.

## Summary

Think's CLI is solid. The JSONL contract, receipt system, and reflect flow are all ahead of what I've seen in comparable tools. The main gaps are:

- **Bugs**: `--help` captures as thought, `--remember` query results not sorted by score
- **Missing discoverability**: no `--help` output
- **Missing visibility**: ambient metadata absent from `--verbose` capture and `--inspect`
- **Missing lifecycle**: no `--forget` tombstone, no reflect session listing/status
- **Missing ergonomics**: no stdin capture, no time-range on `--recent`, no thought linking

None of these are architectural. They are surface-level improvements on a well-designed foundation. The core capture/derive/receipt pipeline is working correctly and the agent-native JSONL contract delivers on its design promise.
