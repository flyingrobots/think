# 0029 M5 Selected-Text And Share-Based Capture

Status: draft for review

## Sponsor

### Sponsor Human

A person who already has meaningful text selected in another macOS app, or who is using a share/send action, and wants to hand that exact text into `think` without retyping it or switching into a second capture workflow.

### Sponsor Agent

An explicit machine consumer that does not need the share surface itself, but does need confidence that this new human ingress path still terminates in the same raw-capture contract and does not create hidden semantics that only exist in a macOS UI.

## Hill

When a human already has text selected in another macOS app, they can explicitly send that exact text into `think` through a native send/share action, using the same sacred raw-capture core and without turning `think` into a clipping product.

## Playback Questions

### Human Playback

- Does selected-text/share capture feel like a fast doorway into the same capture core rather than a second note-taking flow?
- Can I send selected text into `think` in one deliberate action, without being asked for titles, tags, or edits first?
- Does the resulting capture preserve the text I meant to send, and does success/failure feedback stay minimal but trustworthy?

### Agent Playback

- Does this human-focused ingress still terminate in the same raw-capture semantics as CLI and URL capture?
- Does the slice avoid inventing a new meaning for capture that agents cannot reach through the explicit CLI / JSON contract?
- Does provenance remain explicit and additive instead of mutating the raw text or introducing opaque share-only state?

## Non-Goals

This slice does not:

- build a general clipping or bookmarking workflow
- extract page titles, summaries, or rich metadata automatically
- ingest attachments, images, PDFs, or multiple heterogeneous share items
- open a full edit/review screen before capture
- add remote sharing, hosted sync, auth, or callbacks
- redesign the menu bar app or hotkey panel

## Problem

`M5` now has two additional ingress surfaces beyond the original CLI and hotkey panel:

- explicit stdin ingest for shell and agent flows
- local URL-triggered capture for Shortcuts and launcher workflows

That still leaves one very common human gap:

- sometimes the right capture text is already selected in another app
- sometimes the natural user action is "Send this to Think," not "open Think and paste"
- if the only way to get selected text into `think` is copy, switch, paste, and save, that adds friction exactly where capture should feel cheapest

This is useful only if it stays honest:

- selected text must still become a normal raw capture
- the send/share action must remain explicit
- `think` must not drift into becoming a clipping or curation product

## Decision

The next `M5` slice should add explicit selected-text / share-based capture on macOS as another thin ingress adapter over the same raw-capture core.

The core rule is:

- explicit send of exact text into `think`
- not a rich import pipeline
- not a reading-list workflow
- not a special entry kind

## Ingress Model

### v1 Payload Boundary

The v1 selected-text/share slice should accept:

- exactly one plain-text payload

Rules:

- the payload must be explicit text handed off by the invoking app or OS surface
- text is preserved exactly as received at the adapter boundary
- surrounding whitespace and newlines are preserved
- empty text is rejected clearly
- non-text payloads are rejected clearly

### v1 Human Wrappers

The first acceptable wrappers are:

- a macOS selected-text Services or Quick Action style handoff
- a macOS share/send action when the source app can provide text directly

These wrappers should be treated as transport wrappers over one capture boundary, not as separate semantic products.

That means:

- one capture contract
- one save path
- one feedback model

## Save And Feedback Model

Selected-text/share capture must preserve the normal capture doctrine:

1. accept explicit text
2. save locally first
3. run backup afterward on the normal best-effort path
4. keep success boring and failure visible

The user should not be forced through an edit/review step before save.

For v1:

- reuse the existing menu bar app feedback model when available
- avoid opening a large capture editor just because the text came from another app
- keep success lightweight
- keep failures diagnosable

## Provenance

This ingress path may add explicit provenance such as:

- `ingress = selected_text`
- `ingress = share`
- `sourceApp = Safari`
- `sourceApp = Mail`
- `sourceURL = ...` only if the system provides it explicitly and it can be stored as provenance rather than merged into the raw text

That provenance must remain:

- additive
- inspectable
- optional
- separate from the raw capture text

## Agent Parity

This slice does not require agents to use the share/send surface itself.

Agent parity here means:

- no new capture semantics are introduced
- the same exact-text capture remains reachable through:
  - `think "..."`,
  - `think --ingest`, and
  - `--json` capture modes
- any provenance introduced here should remain understandable in inspect/read surfaces rather than becoming hidden UI-only meaning

## Boundaries

Include:

- explicit selected-text handoff
- explicit text share/send handoff
- exact-text capture into the normal raw-capture core
- optional additive provenance

Do not include:

- automatic capture from the focused app
- scraping the clipboard opportunistically
- attachment capture
- multi-item batch import
- rich clipping or page extraction
- text cleanup, summary, or normalization beyond the plain-text handoff boundary

## Recommended Spec Focus

The first red specs for this slice should pin:

- accepted plain-text share payload shape
- exact text preservation for selected text, including whitespace and newlines
- empty/non-text rejection behavior
- optional provenance attachment for selected-text/share ingress
- proof that the adapter routes into the existing capture core rather than inventing a second save path

## Governing References

- [`0001-product-frame.md`](./0001-product-frame.md)
- [`0008-agent-native-cli.md`](./0008-agent-native-cli.md)
- [`0010-ingress-and-derivation-pipeline.md`](./0010-ingress-and-derivation-pipeline.md)
- [`0027-m5-additional-ingress-surfaces.md`](./0027-m5-additional-ingress-surfaces.md)
- [`0028-m5-shortcuts-url-capture.md`](./0028-m5-shortcuts-url-capture.md)
- [`ROADMAP.md`](./ROADMAP.md)

## Next Move

Write failing specs for the selected-text/share adapter contract first, then wire the thinnest viable macOS wrapper over that boundary.
