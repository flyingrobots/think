# 0014 M4 First Derived Artifacts

Status: draft for review

## Intent

Define the first real derivation bundle that makes `inspect` worth using during Milestone 4.

This note exists because the current `browse` and `inspect` surfaces are real, but the derived layer beneath them is still too thin.
Right now the system can show:

- raw capture metadata
- canonical thought identity as a computed display value
- direct `Reflect` descendants

That is useful, but it is not yet the honest machinery view that `inspect` is supposed to become.

The next slice should not be “more graph.”
It should be the smallest derivation substrate that gives `inspect` and later `browse` real receipts.

For the consolidated per-thought catalog of what is derived, when, and with what payload, see [`0015-per-thought-derivation-catalog.md`](./0015-per-thought-derivation-catalog.md).

## Sponsor User

A person who returns to an old thought and wants to understand:

- what this capture is
- how the system sees it
- whether it belongs to a session or local context
- what the system has actually derived so far

Without:

- magical narration
- graph theater
- hidden heuristics
- a dashboard trying to impress them

## Sponsor Agent

An agent using `think` through the explicit CLI/JSON contract that needs to:

- inspect one capture honestly
- see the same canonical identity and derived receipts a human can see
- decide whether a thought is a good seed for `Reflect`
- recover context without scraping TUI output or inventing heuristics locally

## Hill

If a person or agent selects one thought in `think`, they can inspect that thought and see a small, honest bundle of derived receipts that explains what the system concretely knows so far, without mutating the raw thought and without pretending to know more than it does.

## Problem

M4 now has:

- usable `recent`
- a reader-first `browse` shell
- explicit `inspect`

But `inspect` is still underpowered relative to its promise.

The current gap is:

- the graph/derivation doctrine is documented
- the read shell exists
- the first real stored derivation artifacts do not

If we skip this layer and keep adding browse affordances on top of ad hoc derived logic, M4 will drift into:

- one-off heuristics in the CLI
- one-off heuristics in the TUI
- “inspect” that mainly shows raw storage facts
- agent parity in name only

So the next M4 slice should be the first durable derivation bundle.

## Design Decision

The first derived-artifact slice for M4 should include exactly three things:

1. real canonical thought identity completion
2. one first interpretive artifact kind
3. one first contextual artifact kind

This is enough to make `inspect` materially better without dragging in X-Ray scope early.

## The First Bundle

### 1. Canonical Thought Identity Completion

This is not just a display trick.

After raw capture succeeds, the system should complete or recover:

- `capture:<event-id>`
- `thought:<fingerprint>`
- explicit linkage from capture to thought

This makes the content identity durable and queryable instead of recomputed ad hoc in view code.

Expected user-visible value:

- `inspect` can show canonical thought identity as real stored structure
- repeated identical captures can be inspected as distinct capture events that express the same canonical thought

### 2. First Interpretive Artifact: `seed_quality`

This artifact answers a narrow question:

- does this thought look like a plausible `Reflect` seed?

It is not universal truth.
It is a small, inspectable judgment.

It should remain content-oriented and narrow.

Minimum payload:

- `kind = seed_quality`
- `verdict`
- `reasonKind`
- `reasonText`
- `promptFamilies`
- derivation provenance fields

Expected examples:

- plausible seed because it contains a question or proposal marker
- weak seed because it reads like a status note

This artifact should support:

- better `inspect`
- better `Reflect` seed receipts
- later agent selection without local heuristic duplication

### 3. First Contextual Artifact: `session_attribution`

This artifact answers a different question:

- what session does this capture belong to, if the system can attribute one honestly?

For the first slice, session attribution should stay simple and deterministic.

Recommended first rule:

- temporal bucketing with a small idle-gap threshold

This produces:

- explicit `session:<session-id>`
- explicit capture-to-session relationship
- an inspectable receipt for why the capture belongs there

Minimum payload:

- `kind = session_attribution`
- `sessionId`
- `reasonKind`
- `reasonText`
- derivation provenance fields

Expected user-visible value:

- `inspect` can show session placement with receipts
- `browse` can later support session-nearby navigation honestly

## Why These Three

This bundle is the right first cut because it gives:

- content identity
- one content-oriented judgment
- one context-oriented judgment

That is enough breadth to prove the derivation model in code.

It is also deliberately narrower than:

- clustering
- x-ray neighborhoods
- pairing graphs
- archive-wide summary surfaces

Those belong later.

## Data Model Expectations

This note inherits the standing rules from:

- [`0009-graph-derivation-model.md`](./0009-graph-derivation-model.md)
- [`0010-ingress-and-derivation-pipeline.md`](./0010-ingress-and-derivation-pipeline.md)

The important consequences here are:

- raw capture remains immutable
- thought identity is separate from capture identity
- derived artifacts are append-only
- artifacts must record provenance
- missing artifacts must remain inspectably pending rather than being silently fabricated

## Inspect Contract

The first improved `inspect` surface should show four layers:

1. raw capture
2. canonical thought identity
3. interpretive artifacts
4. contextual artifacts

In plain language, that means `inspect` should be able to answer:

- what raw capture event is this?
- what canonical thought does it express?
- does it look like a strong `Reflect` seed?
- what session does it appear to belong to?

And for every claim, it should show receipts.

### Human Surface

Human `inspect` should remain plain and explicit.

Suggested sections:

- `Raw`
- `Canonical Thought`
- `Derived`
- `Context`

If a receipt is missing, the UI should say so directly.

Good:

- `Seed quality: likely_reflectable`
- `Why: Contains explicit proposal language ("should", "could", "what if").`
- `Session: session:...`
- `Why: Captured within 5 minutes of neighboring entries in the same session bucket.`

Bad:

- `This thought is about product strategy and creativity.`

### Agent Surface

Anything meaningful in human `inspect` must have a command/JSON path.

That means:

- canonical thought identity must be available through `--inspect --json`
- each stored artifact receipt must be emitted as machine-readable rows
- contextual receipts must not exist only in the TUI

The TUI may be nicer.
It may not be semantically richer.

## Derivation Timing

This bundle should follow the pipeline doctrine already approved:

### Immediate identity completion

- fingerprint raw content
- recover or create the canonical thought identity

### Fast interpretive derivation

- derive `seed_quality`

### Near-immediate contextual derivation

- derive `session_attribution` when possible

If any stage does not complete:

- raw capture still stands
- inspect should be able to show that the artifact is missing or pending
- replay/re-derivation must be able to fill it in later

## Non-Goals

This slice should not include:

- clustering
- X-Ray neighborhoods
- archive-wide related-thought claims
- linked-thought graphs without receipts
- embeddings
- LLM-assisted spitballing
- silent mutation of old captures

## Playback Questions

- does `inspect` feel materially more truthful once these receipts exist?
- can a person understand what the system knows without needing graph jargon?
- can an agent query the same receipts without scraping presentation output?
- does the first derivation bundle stay narrow enough to implement without dragging in premature X-Ray work?

## Exit Criteria

This slice should count as done only when:

- canonical thought identity is stored and inspectable as real structure
- `seed_quality` exists as a stored artifact with provenance
- `session_attribution` exists as a stored contextual artifact with provenance
- human `inspect` shows these receipts plainly
- JSON `inspect` exposes the same substance for agents
- missing derivations are reported honestly rather than invented at read time

## Recommended Next Step

After this note is approved:

1. write failing acceptance specs for improved `inspect`
2. pin the expected JSON receipt rows for the first artifact bundle
3. implement the smallest end-to-end derivation path that makes those specs pass

That is the right next M4 slice.
