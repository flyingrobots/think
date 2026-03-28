# 0023 Remember Enhancements

Status: proposed — feedback from dogfooding `--remember` in real agent sessions

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

The tier/score/matchKinds structure already provides the ranking backbone. What follows are proposals to give the consumer more control over how much of that ranking they actually consume.

## Proposed Enhancements

### 1. Result Limiting (`--limit=N`)

The most immediately useful addition.

Currently `--remember` returns every entry that scores above threshold. In a tight context window or a project with deep history, this dumps more text than the caller needs.

Proposed shape:

- `think --remember --limit=3`
- `think --remember "query" --limit=5`

Behavior:

- return the top N entries by score, respecting the existing ordering rules (stronger tier first, higher score first, newer first within tier)
- when omitted, current behavior is preserved (return all matches)
- `--limit=0` or negative values should be rejected or ignored

Why this matters for agents:

- an agent starting a session in a repo wants the 3-5 most relevant prior thoughts, not the full archive dump
- context window budget is finite and the agent cannot always predict how large the result set will be
- the scoring already ranks entries — `--limit` just lets the caller say "give me the best N"

### 2. Scoped Query (`--query` or positional argument)

The design doc (0018) already specifies `think --remember "query terms"` as the explicit recall shape. This note reinforces the value of that second axis from real usage.

During testing, `--remember` from `~/git/bijou` returned 8 results — all matched on the token `"bijou"`. But some entries are *entirely about* bijou (a deep architectural analysis) while others merely mention bijou in a list of seven projects. Without a query parameter, there is no way to say "I care about hexagonal architecture in bijou" vs "I care about bijou's role in Continuum."

If query support exists or is planned, it should compose with ambient scoping:

- `think --remember` = ambient context only
- `think --remember "hexagonal architecture"` = ambient context + query relevance
- `think --remember "hexagonal architecture" --limit=3` = ambient + query + budget

### 3. Brief Mode (`--brief`)

A triage surface that returns metadata and the first line of each entry, without full text.

Proposed shape:

- `think --remember --brief`
- `think --remember --brief --limit=10`

Behavior:

- return the same match structure (entryId, score, tier, matchKinds, reasonText, createdAt)
- include only the first line (or first N characters) of the entry text, not the full body
- the caller can then `--inspect` specific entries that look relevant

Why this matters:

- avoids dumping 8 walls of text into context when the caller only needs 1-2
- enables a two-phase recall pattern: triage with `--brief`, then deepen with `--inspect`
- respects context window budget without losing the ability to see what is available

### 4. Session-Start Hook Integration

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

## Playback Questions

Agent stakeholder:

- does `--limit` plus `--brief` give enough control to manage context budget during session startup?
- is the two-phase pattern (brief triage, then inspect) natural or would a single richer result be better?
- would a normalized confidence score change how you threshold recall results?

Human stakeholder:

- does `--brief` feel useful for quick "what do I have here?" checks, or does it just add a step before you read the full text anyway?
- would you want to see ambient metadata at capture time, or is that noise you would ignore?

## Recommended Next Steps

1. `--limit=N` — lowest effort, highest immediate value for both agents and humans
2. `--brief` — enables the triage pattern that makes `--limit` practical
3. ambient metadata visibility at capture time (even if just `--verbose`)
4. sub-ranking within tier 2 fallback for better discrimination on pre-metadata entries
5. session-start hook recipe documented as a consumer integration pattern
