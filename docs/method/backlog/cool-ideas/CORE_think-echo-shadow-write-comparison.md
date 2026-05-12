# Echo shadow-write comparison mode

After the Think-on-Echo round-trip proof works, consider an opt-in shadow-write
mode that writes a capture to the current Think store and to the Echo-backed
contract path, then compares receipts, latency, ids, provenance, and readback.

This is a possible implementation shape for Phase 3, not a requirement.

## Why

Shadow-write gives the new runtime path exposure to real capture shapes without
making Echo the source of product truth too early. It also gives a concrete
way to compare capture latency and evidence posture against the existing
`git-warp`-backed path.

## Guardrails

- The existing store remains authoritative.
- Echo failure must not make local capture fail.
- The mode must be explicitly opt in.
- The comparison output should be inspectable and quiet by default.
- No migration semantics should be inferred from shadow-write success.
