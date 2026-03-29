# M4 Retrospective: Remember Enhancements

Date: 2026-03-29
Status: complete

## Slice Summary

This slice made `--remember` more usable in real work by adding bounded recall and a brief triage mode without changing the underlying recall model.

Delivered behavior:

- `think --remember --limit=<n>` now caps the recall set deterministically
- `think --remember --brief` now shows triage-friendly snippets instead of full multiline thought bodies
- `--json --remember --brief --limit=<n>` preserves explicit receipt fields for agents
- invalid `--limit` values now fail clearly as validation errors

Design commit:

- `8b0f415` - `Refine remember enhancement design`

Spec commit:

- `ab1b373` - `Add remember enhancement specs`

Implementation commit:

- `953a184` - `Add bounded and brief remember recall`

## What We Set Out To Prove

This slice existed to prove:

- bounded recall would make `--remember` calmer and more usable
- a brief triage surface could reduce text dump without becoming a second ranking mode
- the human and agent contracts could stay aligned while reducing context volume

## What Shipped

Implementation:

- [src/cli.js](../../src/cli.js)
- [src/store.js](../../src/store.js)

Specification:

- [test/acceptance/read-modes.test.js](../../test/acceptance/read-modes.test.js)

Supporting design work:

- [docs/design/archive/0018-m4-remember.md](../design/archive/0018-m4-remember.md)
- [docs/design/archive/0023-remember-enhancements.md](../design/archive/0023-remember-enhancements.md)

## Human Stakeholder Playback

Human playback verdict:

- pass

What the human stakeholder validated:

- bounded recall feels useful rather than like option clutter
- brief mode is good enough to keep

## Agent Stakeholder Playback

Agent playback verdict:

- pass

Why:

- the machine-readable contract stayed explicit and inspectable
- `--brief` changes output volume, not recall semantics
- the slice did not introduce hidden ranking or TUI-only behavior

## Design-Conformance Check

Did implementation deviate from the approved design?

- no material drift

What matched:

- the slice stayed narrow:
  - `--limit`
  - `--brief`
- no hook integration, ranking rewrite, or score normalization slipped into implementation
- the underlying remember ranking model stayed unchanged
- brief mode remained a presentation change, not a new retrieval mode

One implementation correction during the slice:

- an intermediate change accidentally made remember ordering score-aware within tier

That was reverted before completion because the approved design explicitly deferred ranking changes.

## What We Learned

- `--remember` was already valuable; it mostly needed better output budgeting
- bounded recall and brief triage were enough to improve usability without rethinking the whole feature
- the design-drift check caught a subtle but important ranking change before it shipped

## Recommendation

Close this slice.

The remaining ideas in [docs/design/archive/0023-remember-enhancements.md](../design/archive/0023-remember-enhancements.md) should stay deferred until new playback earns them.
