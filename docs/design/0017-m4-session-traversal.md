# 0017 M4 Session Traversal

Status: draft for review

## Purpose

Define the next M4 browse slice after session-context browse is already implemented:

- add deliberate traversal within the current session
- keep session traversal distinct from plain chronology traversal
- preserve reader-first browse for humans and explicit parity for agents

This note exists because `browse` can now expose session identity and a session drawer, but it still cannot move through same-session context as a first-class navigation path.

The next question is:

> once a thought has honest session context, how should `browse` let a person or agent move through that session without turning chronology, session, and graph-ness into one muddy navigation model?

## Sponsor Human

Primary sponsor human:

- a person returning to one old thought who wants to recover the local flow that produced it, step through that flow deliberately, and keep the current thought visually primary instead of falling back into a generic list or log

## Sponsor Agent

Primary sponsor agent:

- an explicit CLI/JSON consumer that wants to traverse the same session context around one thought deterministically, inspect why each step is in-session, and do so without scraping TUI presentation or recreating local session logic

## Hill

If a person or agent opens one thought in `think`, they can move through the surrounding session deliberately and predictably, without collapsing session traversal into chronology traversal, and without browse drifting into graph theater.

## Problem

Current M4 now has:

- reader-first `browse`
- summon-only chronology and session drawers
- explicit `inspect`
- explicit in-shell `Reflect`
- first derivation bundle:
  - canonical thought identity
  - `seed_quality`
  - `session_attribution`

That is enough to reveal session context honestly.

It is not yet enough to use that context as navigation.

Today the user can:

- see the current thought
- move older/newer through chronology
- summon a session drawer
- inspect receipts behind session attribution

But they cannot yet do the narrower, more valuable thing:

- step through the current session as a distinct path

If we add that badly, browse will get slippery fast.

The danger is not lack of functionality.
The danger is conflation:

- chronology neighbors are not session neighbors
- a session drawer is not session traversal
- graph-like relatedness is not part of this slice at all

## Design Decision

The next browse slice should add explicit session traversal as a separate navigation mode layered around the current thought.

In plain terms:

- yes to previous/next within the current session
- yes to explicit session position and session-adjacent receipts
- yes to matching agent-facing session traversal semantics
- no to mixing session traversal invisibly into chronology movement
- no to “related thought” jumps
- no to archive-wide neighborhood logic

Session traversal should be local, explicit, and reversible.

## What Session Traversal Should Mean

Session traversal should answer:

- what came just before this thought in the same session?
- what came just after it in the same session?
- where am I inside that session?

It should not answer:

- what thought is merely nearby in time?
- what thought feels semantically related?
- what thought the system thinks I should open next?

The experience rule is:

> chronology remains one navigation axis and session remains another; browse may expose both, but it must never pretend they are the same path.

## Human Surface

Human browse should make session traversal explicit and low-friction.

Good candidates:

- keep chronology navigation labeled as chronology or older/newer
- add clearly distinct session traversal actions with different labels and bindings
- show the current thought's session position in metadata when available
- show whether session traversal is unavailable because the session has only one captured thought
- let the session drawer stay secondary, as overview rather than the primary movement mechanism

Bad candidates:

- reusing older/newer labels for session movement
- silently changing `j` and `k` to mean different things based on context
- hiding chronology once session traversal is present
- turning the session drawer into the default full-screen browse view

This slice should make the user feel:

> I can stay on this thought and move through the surrounding session intentionally.

Not:

> I guess the app jumped somewhere nearby and hopes I won't notice.

## Agent Surface

If the human shell can traverse within a session, the agent surface must be able to do the same job explicitly.

That means the agent-facing browse contract should expose enough information to answer:

- what session is this thought in?
- where is this thought within that session?
- what are the immediate previous and next thoughts in that session?
- why are those thoughts considered part of the same session?

The TUI may make this easier to see.
It may not invent exclusive traversal semantics.

## Candidate Contract Shape

This note does not lock final row names, but the contract should expose something in this family:

- `browse.context`
  - current session identity
  - session position for the current thought
  - session length when known
- `browse.session_entry`
  - ordered same-session entries
  - explicit direction or ordering semantics
- `browse.entry`
  - plain chronological neighbors, kept separate from session traversal

The important rule is:

- session traversal data must be explicit enough that an agent can follow the same session path without scraping TUI labels or guessing from timestamps

## Navigation Doctrine

This slice should preserve three distinct browse concepts:

1. current thought
2. chronology context
3. session context

Only the current thought should own the screen by default.

Chronology and session should both remain secondary structures around that thought.

If the user is traversing by session, the UI should still make chronology visible as separate metadata rather than collapsing it into the same action language.

## Non-Goals

This slice should not include:

- related-thought heuristics
- graph neighborhoods
- clustering
- semantic recommendations
- archive-wide pathfinding
- timeline summaries
- LLM assistance

It should also not replace:

- `recent`
- standalone `inspect`
- the existing explicit JSON browse contract

## Playback Questions

Human stakeholder playback:

- does session traversal help the user recover local flow better than a session drawer alone?
- is the distinction between chronology movement and session movement easy to understand?
- does the current thought remain primary while traversing by session?

Agent stakeholder playback:

- can an agent recover and traverse the same session path without scraping TUI output?
- are session neighbors and session position explicit enough to avoid reimplementing local heuristics?
- does the session traversal contract stay narrow and deterministic?

## Exit Criteria

This slice should count as done only when:

- browse can move to previous and next thoughts within the current session explicitly
- session traversal is clearly distinguished from chronology traversal
- the current thought remains visually primary during session traversal
- machine-readable browse output exposes the same session-traversal semantics
- single-entry sessions behave honestly without fake traversal affordances
- no graph-like related-thought claims are introduced

## Recommended Next Step

After this note is reviewed:

1. write failing tests for human and JSON session-traversal behavior
2. implement the narrow browse traversal slice
3. close the slice with explicit human and agent playback before choosing the next M4 step
