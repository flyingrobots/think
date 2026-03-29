# 0023 Remember Enhancements

Status: implemented and closed

## Sponsor

Primary sponsor human:

- a person standing in a project directory who wants a small, trustworthy recall bundle instead of a full text dump

Primary sponsor agent:

- an agent starting work in a repository that needs bounded prior context with explicit receipts and stable machine-readable output

## Hill

If a person or agent asks `think` to remember prior context, they can request a small, inspectable recall bundle and optionally a brief triage view, without turning `--remember` into generic search, opaque ranking, or prompt-time magic.

## Origin

This note comes from a live dogfooding session where an agent (Claude, using `claude-think` as its thought tool) systematically tested `--remember` across multiple project directories and evaluated the results. The session also included reviewing an external tool ([CARL](https://github.com/ChristopherKahler/carl)) that solves a related problem — session context injection — through keyword-triggered rule loading.

The intent here is to capture concrete enhancement ideas, honest critique, and one borrowed concept that would strengthen `--remember` without violating Think's doctrine.

## What Works Well

The fundamentals are solid:

- ambient project scoping correctly identifies git root, remote, branch, and derives sensible tokens
- the zero-match case is clean and honest (tested against a project with no prior thoughts)
- the scoring system differentiates meaningfully between thoughts captured with ambient metadata (score 265, tier 3, five match kinds) and older text-only fallbacks (score 30, tier 2, one match kind)
- match receipts are explicit and inspectable — you can see exactly why each result was returned
- the JSON contract is agent-ready with no guessing required

The tier/score/matchKinds structure already provides the ranking backbone. What follows narrows the next implementation slice to the highest-value controls over how much of that ranking the caller actually consumes.

## Slice Lock

This slice is intentionally narrow.

Implemented in this slice:

- `--limit=N`
- `--brief`
- composition with existing explicit query recall:
  - `think --remember`
  - `think --remember "query"`
  - `think --remember --limit=3`
  - `think --remember --brief`
  - `think --remember "query" --limit=3 --brief`

Deferred from this slice:

- session-start hook integration
- tier 2 fallback reranking
- score normalization / confidence values
- ambient metadata visibility during capture
- negative-signal or declassification mechanics

The reason for the narrow lock is simple:

- `--limit` and `--brief` materially improve both human and agent use right now
- they do not require inventing a new ranking model
- they preserve the current deterministic, receipt-based recall contract

## Proposed Enhancements

### 1. Result Limiting (`--limit=N`)

The most immediately useful addition.

Currently `--remember` returns every entry that scores above threshold. In a tight context window or a project with deep history, this dumps more text than the caller needs.

Proposed shape:

- `think --remember --limit=3`
- `think --remember "query" --limit=5`

Locked behavior for this slice:

- return the top N entries by score, respecting the existing ordering rules (stronger tier first, higher score first, newer first within tier)
- when omitted, current behavior is preserved (return all matches)
- reject `--limit=0`, negative values, and non-integer values as invalid command usage

Why this matters for agents:

- an agent starting a session in a repo wants the 3-5 most relevant prior thoughts, not the full archive dump
- context window budget is finite and the agent cannot always predict how large the result set will be
- the scoring already ranks entries — `--limit` just lets the caller say "give me the best N"

### 2. Scoped Query (Existing Shape, Explicitly Preserved)

The design doc (0018) already specifies `think --remember "query terms"` as the explicit recall shape. This slice does not add a new query mechanism. It explicitly preserves and composes with the existing positional query form.

During testing, `--remember` from `~/git/bijou` returned 8 results — all matched on the token `"bijou"`. But some entries are *entirely about* bijou (a deep architectural analysis) while others merely mention bijou in a list of seven projects. Without a query parameter, there is no way to say "I care about hexagonal architecture in bijou" vs "I care about bijou's role in Continuum."

Locked composition rule for this slice:

- `think --remember` = ambient context only
- `think --remember "hexagonal architecture"` = ambient context + query relevance
- `think --remember "hexagonal architecture" --limit=3` = ambient + query + budget

### 3. Brief Mode (`--brief`)

A triage surface that returns metadata and the first line of each entry, without full text.

Proposed shape:

- `think --remember --brief`
- `think --remember --brief --limit=10`

Locked behavior for this slice:

- return the same match structure (entryId, score, tier, matchKinds, reasonText, createdAt)
- the entryId is a hard requirement — without it, brief results are a dead end because the caller has no handle to follow up with `--inspect`
- include only the first line (or first N characters) of the entry text, not the full body
- the caller can then `--inspect <entryId> --json` to retrieve the full text of specific entries that look relevant

Important presentation rule:

- `--brief` is a triage surface, not a different ranking mode
- it must not change match ordering, match receipts, or scope resolution
- it only changes how much of each matched thought is rendered

Why this matters:

- avoids dumping 8 walls of text into context when the caller only needs 1-2
- enables a two-phase recall pattern: triage with `--brief`, then deepen with `--inspect`
- respects context window budget without losing the ability to see what is available

### 4. Session-Start Hook Integration

Deferred from this slice.

This is the one concept worth borrowing from CARL, adapted to Think's doctrine.

CARL scans every prompt for keywords and injects matching rules. That is too aggressive — it eats context on every turn and pattern-matches on natural language, which is inherently fragile. But the underlying insight is sound: session startup is the moment when prior context is most valuable and most likely to be missing.

Proposed shape:

- a Claude Code hook (or equivalent) that fires once at session start
- runs `think --remember --brief --limit=5` for the current working directory
- injects the results into the session context

Why this matters:

- currently, context recovery depends on the agent following instructions in CLAUDE.md ("run `--recent` at session start")
- a hook makes this structural rather than behavioral — it happens regardless of whether the agent remembers to do it
- `--brief --limit=5` keeps injection lightweight
- firing once (not on every prompt) respects context budget
- ambient scoping means the right project context is injected without any keyword matching

Important constraints:

- this should be opt-in configuration, not default behavior
- the hook should not block session startup if Think is unavailable or the command fails
- the injected output should be clearly labeled so the agent knows it is recalled context, not a user message
- this does not require changes to Think itself — it is a consumer-side integration pattern — but Think providing `--brief` and `--limit` makes it practical

## Critique And Honest Assessment

### Tier 2 fallback noise

The biggest weakness observed: when all matches are tier 2 fallback-text, there is no discrimination between "this entire thought is about bijou" and "this thought mentions bijou once in a list." Both score 30. This is acknowledged in the design (0018) as expected for pre-ambient-metadata entries, and it will improve naturally as new captures include ambient context. But for repos with long pre-`--remember` history, the fallback tier could benefit from sub-ranking — perhaps weighting by token frequency, position (title/first-line vs buried mention), or proportion of text devoted to the matched token.

### Score opacity

The scores (30, 265) are useful for ordering but opaque in meaning. Is 265 "very confident" or "moderately confident"? Is there a theoretical maximum? A normalized confidence value (0.0-1.0) alongside the raw score would help agents make threshold decisions ("only use entries above 0.7 confidence") without needing to understand the internal scoring formula.

### No negative signals

The current system has no way to say "this thought is NOT about this project even though it mentions the name." If someone captures a thought like "bijou is the wrong name for this framework, should rename to something else," that thought will match strongly on the bijou token forever. A future opt-in declassification mechanism (not at capture time — that violates doctrine — but as a post-hoc correction) might help at scale.

### Ambient metadata is invisible to the thinker

When I captured a thought from within `~/git/bijou`, I had no confirmation that ambient context was recorded. The capture output showed `entryId` and `saved_locally` but did not surface what metadata was attached. A `--verbose` capture mode or an `--inspect` on a fresh capture showing the ambient bundle would build trust that the system is recording what it needs for later recall.

## Relationship To Existing Design

This note extends 0018 (M4 Remember) without contradicting it. The enhancements proposed here — `--limit`, `--brief`, query composition, and session-start integration — are consumer-facing conveniences that sit on top of the scoring and receipt infrastructure 0018 already specifies.

The CARL comparison is included for conceptual context, not as a dependency or integration target. The borrowed concept (session-start injection) is a consumer pattern, not a Think feature.

## Non-Goals

This note does not propose:

- LLM-assisted ranking or reranking
- embeddings or semantic search
- cross-mind recall
- changes to the capture path or capture-time friction
- keyword-triggered prompt scanning (the CARL approach explicitly rejected)
- dashboard or analytics surfaces
- any change to the existing recall ranking formula in this slice
- any TUI-only remember behavior

## Agent Parity

If humans can use `--limit` and `--brief`, agents must be able to do the same job through the explicit command contract.

That means:

- `--json --remember --limit=N` must preserve explicit `remember.scope` and `remember.match` rows
- `--json --remember --brief` must remain equally inspectable
- `--brief` may shorten text payloads, but it must not hide `entryId`, `score`, `tier`, `matchKinds`, or receipt fields

## Human Surface

Human `--remember` should remain plain and boring.

Good:

- `Remember`
- `Scope: current project`
- `Why: matched git remote and repo root`
- short, triage-friendly snippets in `--brief`

Bad:

- dense walls of metadata for every result
- a different layout that implies `--brief` is a different command
- “smart summary” language that hides why results matched

## Playback Questions

Agent stakeholder:

- does `--limit` plus `--brief` give enough control to manage context budget during session startup?
- is the two-phase pattern (brief triage, then inspect) natural or would a single richer result be better?
- would a normalized confidence score change how you threshold recall results?

Human stakeholder:

- does `--brief` feel useful for quick "what do I have here?" checks, or does it just add a step before you read the full text anyway?
- does `--limit` make recall feel calmer and more usable, or does it feel like unnecessary option clutter?

## Outcome

Human playback result:

- pass

Agent playback result:

- pass

Delivered implementation:

- `think --remember --limit=<n>` now returns a bounded recall set without changing the underlying ranking model
- `think --remember --brief` now renders triage-friendly snippets instead of full multiline thought bodies
- `--json --remember --brief --limit=<n>` preserves the explicit agent contract:
  - `remember.scope`
  - `remember.match`
  - `entryId`
  - `score`
  - `tier`
  - `matchKinds`
  - `reasonText`
- invalid `--limit` values now fail clearly as command validation errors

Deferred items remain deferred:

- session-start hook integration
- tier 2 fallback reranking
- score normalization / confidence values
- ambient metadata visibility during capture
- negative-signal or declassification mechanics
