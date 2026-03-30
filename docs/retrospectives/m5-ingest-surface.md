# M5 Explicit Ingest Surface

Date: 2026-03-30

Design note:

- [`0027-m5-additional-ingress-surfaces.md`](../design/0027-m5-additional-ingress-surfaces.md)

Implementation commits:

- `1f224fe` — `Add M5 ingest specs`
- `905cd74` — `Add explicit stdin ingest surface`

## Goal

Land the first `M5` ingress adapter as an explicit stdin / pipe-friendly capture surface without changing raw-capture doctrine.

## Shipped

- `think --ingest` reads stdin explicitly
- stdin ingest terminates in the same raw-capture core as ordinary CLI capture
- plain `think` without `--ingest` does not silently consume piped stdin
- `--json --ingest` preserves the normal machine-readable capture contract
- empty stdin and mixed positional-plus-stdin input fail clearly

## Human Playback

Verdict: pass

Observed outcome:

- the surface felt like a real first-class capture doorway
- it remained boring and predictable
- the newest entry looked like an ordinary raw capture, not a second-class imported object

## Agent Playback

Verdict: pass

Why:

- ingest is explicit rather than ambient
- the machine contract is unchanged apart from the ingress source
- validation boundaries are honest and deterministic

## Design-Drift Check

No material drift.

The shipped behavior matches the approved first-slice intent:

- explicit command
- exact text preservation
- same local-first durability model
- explicit JSON parity

## What We Learned

- explicit stdin ingress is enough to make `think` more automation-friendly without broadening the product into a service
- the right pattern for `M5` is still "more doors into the same room"
- keeping the ingest contract identical to ordinary capture was the correct decision

## Next

- move to the second `M5` slice: macOS Shortcuts / URL-triggered capture
