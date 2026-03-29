# 0016 M4 Session-Context Browse

Status: implemented for the first session-context browse slice

## Purpose

Define the next M4 slice after the first derivation bundle:

- make `browse` use `session_attribution` honestly
- improve human reentry without inventing graph theater
- preserve agent parity through explicit command and JSON surfaces

This note exists because the first browse shell and the first derivation bundle now both exist.
The next question is no longer “can we browse one thought?” It is:

> once a thought has session context, how should `browse` use that context without becoming a dashboard or a graph explorer?

## Sponsor Human

Primary sponsor human:

- a person returning to one old thought who wants to recover the local flow around that thought without losing the reader-first feel or being forced into a giant archive view

## Sponsor Agent

Primary sponsor agent:

- an explicit CLI/JSON consumer that wants to recover the same local session context around one thought, inspect the receipts behind it, and traverse that context without scraping TUI presentation

## Hill

If a person or agent opens one thought in `think`, they can recover the immediate session context around that thought through explicit receipts and deliberate navigation, without collapsing browse into graph theater or hiding the raw thought behind a context view.

## Problem

Current M4 now has:

- `recent`
- a reader-first `browse` shell
- `inspect`
- the first derivation bundle:
  - canonical thought identity
  - `seed_quality`
  - `session_attribution`

That is enough structure to do something useful with session context.

But today `browse` still behaves mostly like:

- one current thought
- immediate chronological neighbors
- optional chronology drawer
- optional inspect drawer

That is good groundwork.
It is not yet the richer reentry value M4 is aiming for.

The next useful step is not “related thoughts.”
The next useful step is the narrower, more honest thing:

- session-nearby browse

## Design Decision

The next browse slice should use `session_attribution` as the first real context layer.

In plain terms:

- yes to session-aware browsing
- yes to visible session receipts
- yes to explicit agent-facing session context rows
- no to inferred related-thought graphs
- no to archive-wide neighborhoods
- no to clustering or X-Ray language

## What Session-Context Browse Should Mean

The default browse posture should remain:

- one current thought
- raw text visually primary
- timestamp and identity visible

Session context should deepen that view, not replace it.

The next slice should add:

- visible session identity for the current thought
- clear indication of whether older/newer thoughts are in the same session
- ability to traverse within the current session deliberately
- a summon-only session drawer or session-focused context view
- receipts for why the current thought is considered part of that session

The key experience rule is:

> session context is local scaffolding around the current thought, not a second homepage.

## Human Surface

Human browse should make session context useful without becoming noisy.

Good candidates:

- show `Session: session:...` in the metadata area
- label session-nearby neighbors explicitly when they exist
- let the user summon a session drawer
- let the user stay in the current-reader view while stepping through session-nearby thoughts

Bad candidates:

- opening directly into a session list instead of a thought
- replacing the current thought with a big context table
- showing graph jargon
- showing unrelated thoughts just because they are nearby in time

## Agent Surface

If the human browse shell can do something meaningful with session context, the agent surface must be able to do the same job through explicit contracts.

That means the next slice should define machine-readable browse outputs for:

- the current thought's session id
- the current thought's session-attribution receipt
- session-nearby entries when present

The TUI may provide nicer navigation.
It may not provide exclusive semantics.

## Candidate Contract Shape

This note does not lock the final event names, but the agent-facing surface should expose something in this family:

- `browse.entry` for chronological neighbors
- `browse.context` or equivalent for session identity / receipt
- `browse.session_entry` or equivalent for session-nearby entries

The important point is not the exact row names.
The important point is:

- the human shell and the agent plumbing must talk about the same session context

## Non-Goals

This slice should not include:

- clustering
- X-Ray neighborhoods
- graph maps
- fuzzy “related thought” claims
- LLM assistance
- timeline summaries
- dashboard-like archive overviews

## Playback Questions

Human stakeholder playback:

- does session-aware browse make it easier to recover the local flow around one thought?
- does the current thought still feel primary?
- does the added context feel helpful rather than decorative?

Agent stakeholder playback:

- can an agent recover the same session context without scraping the TUI?
- are the receipts explicit enough to avoid re-implementing local heuristics?
- does the browse contract stay narrow and deterministic?

## Exit Criteria

This slice should count as done only when:

- browse can expose session identity honestly
- browse can reveal session-nearby context without hiding the current thought
- machine-readable browse output exposes the same meaningful session context
- no related-thought or graph-neighborhood claims are introduced without explicit receipts
- the result still feels like browse, not inspect-plus-more-noise

## Outcome

The first session-context browse slice now exists.

Delivered behavior:

- browse metadata shows explicit session identity for the current thought
- the Bijou browse shell has a summon-only `SESSION` drawer
- the session drawer shows only same-session entries
- JSON browse output exposes:
  - `browse.context`
  - `browse.session_entry`
- the reader-first browse posture remains intact

## Retrospective Reference

For the implementation closeout and playback notes, see:

- [`../retrospectives/m4-session-context-browse.md`](../retrospectives/m4-session-context-browse.md)

## Recommended Next Step

Do not assume the next M4 slice automatically.

After this slice is closed:

1. evaluate human playback
2. evaluate agent playback
3. choose the next narrow M4 slice from that playback, rather than letting browse sprawl by inertia
