# 0018 M4 Remember

Status: proposed for the next M4 reentry slice

## Purpose

Define the next M4 reentry slice:

- add an explicit `--remember` read surface for context-scoped recall
- support both ambient project recall and explicit query recall
- preserve the distinction between recall, recent listing, browse, and inspect
- keep agent parity through an explicit JSON contract

This note exists because M4 now has:

- `recent` for flat newest-first reentry
- `browse` for deliberate navigation
- `inspect` for explicit receipts

What it does not yet have is a direct answer to the question:

> what was I thinking about this?

That is the job `--remember` should do.

## Sponsor Human

Primary sponsor human:

- a person standing in a project directory who wants to recover the most relevant prior thoughts about that project or topic quickly, without manually browsing the whole archive and without needing to remember exact wording

## Sponsor Agent

Primary sponsor agent:

- an agent starting work in a repository or directory that wants to reconstruct the most relevant recent local context for that work, through explicit CLI and JSON contracts, without scraping ANSI output or treating the archive like raw grep text

## Hill

If a person or agent is standing in a project context or has a specific topic in mind, they can ask `think` to remember the most relevant prior thoughts for that context, with explicit receipts for why those thoughts were returned, without adding any classification burden to capture and without turning recall into opaque ranking theater.

## Problem

The current read surfaces answer different questions:

- `recent`
  - what did I capture most recently?
- `browse`
  - where is this thought in the archive?
- `inspect`
  - what does the system know or claim here?

Those are useful.
They do not yet answer:

- what was I thinking about this repo?
- what did I last think about this topic?
- what context should I rehydrate when I open work here again?

That gap matters especially for agents, but it is also useful for humans.

Without a dedicated recall surface, the fallback is one of two bad behaviors:

- scroll the archive and hope chronology helps
- add more search-like filters to `recent` until it quietly becomes a generic archive command

Both are the wrong move.

## Design Decision

Add a new read-only command:

- `think --remember`
- `think --remember "query terms"`

The command should behave like recall, not generic search.

In plain terms:

- no argument means:
  - use the current working context to retrieve relevant prior thoughts about where the user is standing
- explicit argument means:
  - retrieve relevant prior thoughts about the provided topic or phrase

The command should remain:

- deterministic
- inspectable
- receipt-like
- local-first

It should not:

- require user-supplied tags
- depend on LLM interpretation
- hide why results matched

## What `--remember` Should Mean

`--remember` should feel like:

- “what was I thinking about this?”
- “rehydrate the local context around this work”

It should not feel like:

- `grep`
- a dashboard
- semantic magic
- “related thoughts” theater

The experience rule is:

> recall is reconstructing likely relevant context, not proving that a specific string exists somewhere in the archive.

## Two Entry Shapes

### 1. Ambient Recall

Command:

- `think --remember`

This mode should use ambient execution context, starting with the current working directory.

Recommended first context sources:

- current working directory path
- current Git root, when inside a Git repository
- current Git remote, when available
- current branch, when available

These are passive facts about where the user or agent is standing.
They do not require classification at capture time.

Ambient recall should prefer thoughts that match the current project context through stored ambient receipts when those exist.

### 2. Explicit Recall

Command:

- `think --remember "search terms"`

This mode should use deterministic fuzzy matching over the archive to recover relevant prior thoughts for the explicit phrase.

The quoted positional argument is the right shape here because:

- the leading `--remember` already disambiguates command from capture
- the remaining text can stay a human phrase instead of turning into option clutter

## Ambient Context Capture

For ambient recall to become honest and useful at scale, captures should record a small amount of passive ambient context when available.

Recommended first bundle:

- `cwd`
- `gitRoot`
- `gitRemote`
- `gitBranch`

Important constraints:

- this must remain passive metadata collection
- capture must never prompt for any of it
- missing metadata must be allowed and common
- failure to collect ambient context must never block raw capture

This does not violate the “no structure at capture time” doctrine because the thinker is not being asked to decide anything.

It is environmental provenance, not user-authored classification.

## Historical Compatibility

Older captures will not have ambient context metadata.

`--remember` must stay honest about that.

The first slice should therefore allow two match families:

1. ambient metadata match
2. textual fallback match

That means:

- newly captured thoughts can be recalled through explicit ambient receipts
- older thoughts can still surface through deterministic textual matching
- receipts must show which kind of match occurred

The system should not pretend older entries had metadata they never recorded.

## Result Ordering

The first slice should keep ordering deterministic and inspectable.

Recommended ordering:

1. stronger scoped matches before weaker ones
2. within the same match tier, higher textual relevance before lower relevance
3. within the same relevance tier, newer before older

The exact scoring formula can evolve later.
The important rule for v1 is:

- result order must be stable
- the match basis must be inspectable
- the command must not feel random

## Human Surface

Human `--remember` should stay plain.

Suggested shape:

- `Remember`
- explicit statement of scope:
  - current project / cwd
  - or explicit query
- a short list of matched thoughts
- receipts per result such as:
  - matched current git remote
  - matched repo name token
  - matched query terms
  - fallback textual match only

Good:

- `Scope: current project`
- `Why: matched git remote and repo root`
- `Why: matched query terms "warp" and "memory"`

Bad:

- `These thoughts seem spiritually related.`

## Agent Surface

If humans can use `--remember`, agents must be able to do the same job through the explicit command contract.

That means:

- `--json --remember` must exist
- no meaningful recall behavior may exist only in the human presentation
- ambient scope resolution and match receipts must be surfaced explicitly

Candidate row families:

- `remember.scope`
  - scope kind
  - cwd / git-derived fields when relevant
  - explicit query when relevant
- `remember.match`
  - entry id
  - text
  - createdAt
  - score
  - match kind(s)
  - receipt text or receipt fields

The exact row names can still change during spec writing.
The important rule is:

- an agent must be able to explain why each remembered thought was returned without recreating local heuristics

## Relationship To Existing Read Surfaces

`--remember` should complement existing modes, not replace them.

- `recent`
  - flat chronology
- `remember`
  - scoped recall
- `browse`
  - deliberate navigation once a thought is selected
- `inspect`
  - explicit machinery view for one thought

The flow should feel like:

- `remember` finds the likely right entry
- `browse` and `inspect` deepen from there

Not:

- `remember` becomes a universal search shell

## Non-Goals

This slice should not include:

- LLM-assisted ranking
- embeddings
- graph-neighborhood recommendations
- cross-mind recall
- capture-time prompts for tags or project names
- a full search language
- a dashboard-like “memory console”

It should also not silently mutate:

- `recent` into generic search
- `browse` into a search-first archive UI

## Design Questions Resolved For V1

### Deterministic or LLM-assisted?

V1 should be deterministic.

Reason:

- inspectable receipts matter more than semantic cleverness here
- agent parity is easier
- replayability is stronger
- the product question is still whether scoped recall is useful at all

### Ambient scope metadata at capture time?

Yes, when available, as passive best-effort metadata.

Reason:

- it materially improves later recall
- it does not add capture friction
- it keeps recall from devolving into plain text search

### Search across minds?

No, not in v1.

`--remember` should search only the active mind/repo.

Reason:

- multiple minds are still deferred
- cross-mind recall raises identity and privacy questions we have not earned yet

## Playback Questions

Human stakeholder playback:

- does `--remember` feel like “what was I thinking about this?” rather than generic search?
- does ambient recall from a project directory feel useful enough to become habitual?
- are the receipts understandable without being noisy?

Agent stakeholder playback:

- can an agent starting in a repository recover useful prior context without archive scraping?
- are ambient scope resolution and match receipts explicit enough to avoid reimplementing local heuristics?
- does the JSON contract stay deterministic and inspectable?

## Exit Criteria

This slice should count as done only when:

- `think --remember` works as ambient context recall
- `think --remember "..."` works as explicit deterministic recall
- recall remains read-only
- capture remains frictionless and does not depend on ambient metadata success
- machine-readable `--json` output exposes scope and match receipts explicitly
- older entries without ambient metadata remain recallable through honest fallback behavior
- the result feels like recall, not grep and not graph theater

## Recommended Next Step

The next move after this design note is:

1. write tests-as-spec for:
   - ambient recall from cwd / Git context
   - explicit recall by query phrase
   - JSON scope and match receipts
   - honest fallback behavior for older entries without ambient metadata
2. implement passive ambient capture metadata
3. implement deterministic remember retrieval over the active mind
