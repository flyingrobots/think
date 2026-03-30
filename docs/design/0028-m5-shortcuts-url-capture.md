# 0028 M5 Shortcuts And URL-Triggered Capture

Status: draft for review

## Sponsor

### Sponsor Human

A person who has a thought while using another macOS app, launcher, or automation surface and wants to hand that thought into `think` immediately without switching into the terminal or manually opening the capture panel first.

### Sponsor Agent

An explicit machine client that does not need the URL scheme itself, but does need confidence that the new human ingress surface terminates in the same raw-capture semantics as normal CLI capture and does not introduce hidden human-only meaning.

## Hill

When a human has text in a macOS Shortcut, launcher, or URL-triggered workflow, they can send it into `think` immediately and locally through the same sacred raw-capture core, without turning `think` into a daemon or import pipeline.

## Playback Questions

### Human Playback

- Does URL- or Shortcut-triggered capture feel like another doorway into the same capture core rather than a separate workflow?
- Can I send text into `think` from another app in one step, without being asked for extra structure?
- Is the save result visible enough to feel trustworthy without becoming noisy?

### Agent Playback

- Does this human-only surface avoid creating new capture semantics that agents cannot reach through the normal CLI contract?
- Does the URL/Shortcut path still save locally first and preserve exact text?
- Does provenance stay explicit and additive rather than mutating the raw capture?

## Non-Goals

This slice does not:

- build a background daemon or local HTTP service
- add selected-text clipping or share-sheet import behavior
- invent a new machine-readable URL response protocol
- redesign the macOS capture panel
- add interpretation, tagging, or summarization during ingress
- add auth, collaboration, or remote-triggered hosted capture

## Problem

The first `M5` slice proved that `think` can accept explicit ingress from a non-interactive shell context through `--ingest`.

That still leaves a high-value human gap:

- many thoughts appear while the user is in another macOS app
- many local automations are easier to express as a Shortcut, launcher action, or custom URL than as a shell command
- the current hotkey panel is excellent, but it still assumes the user will switch into a `think`-owned interaction

If `think` can only capture well when the user intentionally enters its terminal or hotkey surface, it remains a tool.

If local macOS workflows can hand exact text into the same capture core, it becomes a more useful substrate.

## Decision

The second `M5` slice should be:

- a local custom URL ingress for capture
- designed so Apple Shortcuts is the first human wrapper over that URL

The core rule is:

- URL/Shortcut capture is another thin adapter over the same raw-capture core
- not a new workflow with its own storage, queue, or semantics

## Invocation Model

### v1 URL Shape

The first supported URL shape should be:

- `think://capture?text=<urlencoded-text>`

Documented optional parameters:

- `ingress=shortcut|url`
- `sourceApp=<app-name>`

Rules:

- `text` is required for v1 capture
- `text` is percent-decoded and preserved exactly as the raw capture body
- newline and punctuation are preserved through normal URL decoding
- unsupported parameters must not affect raw-capture semantics

### v1 Shortcuts Shape

Apple Shortcuts should be treated as a wrapper over the URL scheme, not a separate semantic surface.

That means a Shortcut can:

- collect or receive text
- URL-encode it
- invoke `think://capture?...`

This keeps the first implementation thin:

- one local ingress contract
- one human-friendly wrapper
- no new app-specific capture logic beyond URL handling

## Runtime Ownership

The installed local macOS `think` app should own the URL scheme and route successful invocations into the existing shared capture core.

That means:

- no always-on daemon
- no separate listener process
- no server socket
- no divergence from the menu bar app/runtime already present in the product

## Save And Feedback Model

URL-triggered capture should preserve the normal capture doctrine:

1. local save first
2. backup best-effort afterward
3. no mutation of the raw text before save

Human-visible feedback should stay minimal and trustworthy.

For v1, that means:

- the same menu bar app save-state feedback model should be reused when available
- no large modal success UI
- no extra confirmation form
- failures should be visible enough to diagnose, but success should remain boring

## Provenance

The URL/Shortcut path may add provenance such as:

- `ingress = shortcut`
- `ingress = url`
- `sourceApp = Finder`
- `sourceApp = Safari`

That provenance must remain:

- additive
- inspectable
- separate from the raw text
- optional rather than required

## Agent Parity

This slice does not require agents to use the URL scheme itself.

Agent parity for this slice means:

- the new human ingress surface must not create new capture semantics
- equivalent exact-text capture already remains available to agents through:
  - `think "..."`,
  - `think --ingest`, and
  - `--json` capture modes

So the parity requirement here is semantic parity, not transport parity.

## Boundaries

This slice should stay narrow.

Include:

- local custom URL capture
- Shortcuts as the first practical wrapper
- exact-text save into the normal raw-capture core
- optional provenance fields

Do not include:

- empty URL invocation opening a draft panel
- selected-text clipping workflows
- share extension plumbing
- structured note fields
- bulk import behavior
- callback URLs or mini-API behavior

## Recommended Spec Focus

The first red specs for this slice should pin:

- accepted URL payload shape
- exact-text preservation through URL decoding
- local-save-first behavior
- minimal provenance attachment
- invalid or missing `text` behavior
- no semantic divergence from ordinary capture

## Governing References

- [`0001-product-frame.md`](./0001-product-frame.md)
- [`0008-agent-native-cli.md`](./0008-agent-native-cli.md)
- [`0010-ingress-and-derivation-pipeline.md`](./0010-ingress-and-derivation-pipeline.md)
- [`0027-m5-additional-ingress-surfaces.md`](./0027-m5-additional-ingress-surfaces.md)
- [`ROADMAP.md`](./ROADMAP.md)

## Next Move

Write failing specs for the URL ingress contract and the first Shortcut-shaped wrapper expectations.
