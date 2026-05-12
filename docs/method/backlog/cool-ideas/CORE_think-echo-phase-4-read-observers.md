---
id: CORE_think-echo-phase-4-read-observers
blocks:
  - CORE_think-echo-phase-5-migration-and-sibling-exchange
blocked_by:
  - CORE_think-echo-phase-2-runtime-roundtrip
---

# CORE - Phase 4 - Echo-backed read observers

Legend: CORE

## Idea

Extend the Think-on-Echo proof from exact inspect to real read surfaces:

- recent chronology
- remember observers
- browse observers
- first-class mind identity

This phase should be pulled only after raw capture plus exact inspect already
works through Echo.

## Why

Think's read surfaces are where the product becomes useful after capture. They
are also where the current graph-backed model leaks implementation details:
global chronology, repo-directory mind selection, and read handles that do not
publish explicit reading posture.

Echo-backed observers should make the read question explicit:

```text
basis + aperture + observer plan -> ReadingEnvelope + Think payload
```

## Candidate Slices

- `RecentThoughts` observer over one mind and time window.
- `RememberThoughts` observer with deterministic lexical or project-aware
  matching before any embedding/ranking work.
- `BrowseWindow` observer over a bounded chronology window.
- `mindId` and `actorId` scoping in all read requests.

## Acceptance Criteria

- Each read surface is expressed as a Think-owned query or observer contract.
- Every read result carries explicit completeness, residual, or obstruction
  posture from the runtime boundary.
- Reads can be scoped by `mindId`.
- No observer silently presents a narrowed reading as canonical full history.
- Existing TUI/remember behavior is not replaced until the new observers have
  proof coverage.
