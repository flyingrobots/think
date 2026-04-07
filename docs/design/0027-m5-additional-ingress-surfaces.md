# 0027 M5 Additional Ingress Surfaces

Status: in progress

## Sponsor

### Sponsor Human

A person who has a thought in a context where the current primary capture surfaces are not the natural place to record it, but who still wants the same cheap, exact, local-first capture experience.

### Sponsor Agent

An explicit CLI or automation consumer that needs to write raw thoughts into `think` through stable machine-readable contracts rather than through a TUI, scraping, or human-only UI flows.

## Hill

When a thought appears outside the terminal or the macOS hotkey panel, a human or agent can still get it into `think` immediately, exactly, and locally through a thin ingress adapter that terminates in the same sacred raw-capture core.

## Playback Questions

### Human Playback

- Does the new ingress surface feel like another doorway into the same capture core rather than like a separate note-taking workflow?
- Can I capture quickly from the new context without being asked for more structure than plain `think "..."` asks for?
- Does the ingress surface preserve exact wording and remain boring about save/backup state?

### Agent Playback

- Does the ingress surface keep the machine contract explicit rather than relying on UI automation or scraping?
- Does the ingress path terminate in the same raw-capture semantics as the existing CLI and macOS panel?
- Does provenance remain honest without polluting the raw thought itself?

## Non-Goals

This milestone does not:

- add new retrieval, clustering, or graph-intelligence behavior
- create a hosted service or central daemon
- add ambient capture that silently watches user behavior
- redesign browse, inspect, remember, or reflect
- build a full mobile app
- add collaboration or auth

## Problem

`think` now has two excellent ingress surfaces:

- direct CLI capture
- the macOS menu bar capture panel

That proves the core doctrine, but it still leaves an important gap:

> thoughts often appear in places where neither of those two surfaces is the natural next action

Examples:

- while a script or agent is already holding text on stdin
- while the user is in another macOS app that could hand off selected text or a quick note
- while a local automation or launcher can invoke a URL or shortcut more easily than a shell command

If `think` only captures well from its own preferred surfaces, it remains a good tool.

If `think` can accept raw capture from the places where thoughts actually appear, it becomes a substrate.

## Decision

`M5` should be about thin additional ingress surfaces over the same capture core.

The key rule is:

- more doors into the same room
- not multiple mini-products with different capture doctrines

Every ingress surface must terminate in the same raw-capture boundary:

1. accept exact user or agent text
2. save locally first
3. keep backup best-effort and downstream
4. preserve explicit provenance without mutating the raw text

## Ingress Doctrine

### 1. Capture Semantics Must Stay Uniform

No ingress surface should ask for more than plain capture asks for.

That means:

- no required tags
- no required titles
- no ontology
- no interpretation before save
- no “smart clipping” that rewrites the text before capture

If an ingress surface cannot stay this boring, it should not be in `M5`.

### 2. Provenance May Be Richer, But Must Stay Explicit

Additional ingress surfaces may carry more contextual metadata than plain shell capture.

Possible provenance examples:

- `ingress = stdin`
- `ingress = shortcut`
- `ingress = share_sheet`
- `sourceApp = Safari`
- `sourceApp = Mail`

That provenance should be:

- explicit
- inspectable
- additive
- separate from the raw text itself

### 3. Agent Parity Is Required

If a human-facing ingress surface introduces a meaningful new capture capability, agents should be able to reach equivalent capture semantics through an explicit command contract.

That means:

- no meaningful ingress capability may exist only behind a human UI
- agent paths should remain explicit, deterministic, and local-first

### 4. No Daemon-Centric Architecture

This milestone should not convert `think` into a service-first system.

Allowed:

- thin invoked adapters
- local OS hooks or app intents
- explicit on-demand URL or shortcut entry

Not allowed:

- background listener sprawl
- always-on local service as the new center of gravity
- hidden ingestion endpoints that silently expand the product surface

## Candidate Ingress Surfaces

### First Slice: Explicit Pipe / Ingest Surface

Status:

- implemented and closed

Recommended first slice:

- `echo "thought" | think --ingest`
- or equivalent explicit stdin-focused capture entry

Why first:

- strongest human+agent leverage
- least UI complexity
- keeps semantics brutally clear
- fits the existing CLI contract naturally

Required behavior:

- explicit command, not accidental stdin capture
- exact text preservation
- same local-first durability model
- explicit JSON parity

Shipped behavior:

- `think --ingest` now reads stdin explicitly and routes it through the normal raw-capture core
- plain `think` without `--ingest` still does not consume piped stdin accidentally
- `--json --ingest` preserves the normal machine-readable capture envelope
- mixed positional capture text plus stdin text is rejected clearly
- empty stdin is rejected clearly

### Second Slice: macOS Shortcuts / URL Scheme

Status:

- implemented and closed

Design note:

- [`0028-m5-shortcuts-url-capture.md`](./0028-m5-shortcuts-url-capture.md)

Recommended second slice:

- local shortcut or URL-triggered capture

Why second:

- high human leverage
- integrates with real macOS workflows without building a bigger app
- still thin and explicit

Required behavior:

- same raw capture semantics
- clear local invocation model
- no dependency on a hosted service

Shipped behavior:

- `think://capture?text=...` is now a real local ingress contract
- the menu bar app owns the `think` URL scheme and routes accepted payloads into the same capture core
- Apple Shortcuts can use the URL scheme as a thin wrapper rather than a separate save path
- the packaged `.app` resolves the CLI correctly when launched by macOS
- the tray menu now exposes build/version metadata for debugging and supportability

### Third Slice: Selected-Text / Share-Based Capture

Status:

- next

Design note:

- [`0029-m5-selected-text-share-capture.md`](./0029-m5-selected-text-share-capture.md)

Recommended third slice:

- capture selected text or a quick note from another macOS app

Why third:

- useful, but easier to get wrong
- risks slipping into clipping/productivity-tool behavior

Required behavior:

- explicit send-to-think action
- preserve source text exactly
- keep provenance inspectable
- do not mutate into summary or extractive intelligence

## Candidate Order

Recommended order for `M5`:

1. explicit pipe / ingest surface
2. macOS Shortcuts / URL-triggered capture
3. selected-text / share-based capture

This order keeps the milestone grounded in:

- explicitness
- reuse of the sacred capture core
- minimal surface-area expansion

## Exit Criteria

`M5` is successful when:

- at least one new human ingress surface and one agent-friendly ingress surface are implemented
- all new ingress surfaces terminate in the same raw-capture contract
- provenance remains additive and inspectable
- capture remains cheap and exact
- no new ingress path centralizes the architecture around a daemon
- no ingress path leaks interpretation into the capture moment

## Governing References

This note should be read alongside:

- [`0001-product-frame.md`](./0001-product-frame.md)
- [`0008-agent-native-cli.md`](./0008-agent-native-cli.md)
- [`0010-ingress-and-derivation-pipeline.md`](./0010-ingress-and-derivation-pipeline.md)
- [`ROADMAP.md`](./ROADMAP.md)

## Next Move

The next design/spec/implementation slice under `M5` should be:

- macOS Shortcuts / URL-triggered capture

That slice should pin:

- sponsor human
- sponsor agent
- exact invocation model
- provenance model
- JSON parity boundary
- non-goals that keep it from turning into a daemon, import pipeline, or clipping workflow
