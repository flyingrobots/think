---
id: CORE_think-echo-phase-3-experimental-product-path
blocks:
  - CORE_think-echo-phase-4-read-observers
blocked_by:
  - CORE_think-echo-phase-2-runtime-roundtrip
---

# CORE - Phase 3 - Experimental Think on Echo product path

Legend: CORE

## Idea

After the round-trip proof works, expose it through an explicit experimental
Think surface without replacing the current store by accident.

Possible shapes:

- an internal proof command
- an opt-in CLI flag
- a separate dev-only command
- a shadow-write mode that writes to Echo while the existing store remains the
  source of product truth

The cycle that pulls this card should choose one.

## Why

The proof needs a product-adjacent path before it can teach us about capture
latency, operational ergonomics, and real data shapes. But switching the
default capture path too early risks user data and hides migration work.

## Acceptance Criteria

- The Echo-backed path is explicitly opt in.
- The default Think capture behavior remains unchanged.
- The path reports enough evidence to compare current store capture with Echo
  capture.
- The path has a clear failure posture that does not threaten the existing
  local capture.
- The implementation defines whether it is proof-only, shadow-write, or a
  candidate replacement path.

## Non-Goals

- No default store replacement.
- No automatic migration.
- No cross-runtime exchange.
- No UI polish beyond what is needed to operate and inspect the proof.
