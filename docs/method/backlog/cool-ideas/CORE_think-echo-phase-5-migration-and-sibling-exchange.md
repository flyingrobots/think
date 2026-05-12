---
id: CORE_think-echo-phase-5-migration-and-sibling-exchange
blocks: []
blocked_by:
  - CORE_think-echo-phase-2-runtime-roundtrip
  - CORE_think-echo-phase-4-read-observers
---

# CORE - Phase 5 - Mind migration and sibling runtime exchange

Legend: CORE

## Idea

Define the path from existing `git-warp`-backed Think minds into the
Think-on-Echo world, and later define how `git-warp` participates as a sibling
runtime through Continuum exchange.

This is deliberately later than the raw capture/read proof.

## Why

Existing `~/.think/*` minds are durable user data. They must not be abandoned.
But migration should follow a working destination, not precede it.

The future `git-warp` role should be explicit:

- data rescue and continuity for old minds
- export/replay/import of Think entries into the new contract path
- witnessed suffix exchange when both runtimes participate in one shared
  causal history

It should not be an implicit storage swap.

## Candidate Slices

1. Export old Think entries into a portable replay format.
2. Replay exported entries through the Think contract path into Echo.
3. Verify entry ids, content digests, timestamps, ingress, mind identity, and
   provenance.
4. Define duplicate and idempotency behavior.
5. Add `git-warp` suffix export/import only when the Continuum runtime-boundary
   family can carry the evidence honestly.

## Acceptance Criteria

- No migration runs without a backup or dry-run path.
- Migration preserves raw capture text and provenance.
- Migration makes `mindId` explicit for legacy repo-directory minds.
- Duplicate import is idempotent or visibly obstructed.
- `git-warp` participation uses witnessed suffix exchange or an explicitly
  documented interim export path.
- The current v17 repair work remains scoped to keeping existing minds usable,
  not defining the new runtime architecture.
