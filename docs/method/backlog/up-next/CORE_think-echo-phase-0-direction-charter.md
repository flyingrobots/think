---
id: CORE_think-echo-phase-0-direction-charter
blocks:
  - CORE_think-echo-phase-1-app-contract
blocked_by:
  - CORE_think-echo-contract-proof
---

# CORE - Phase 0 - Think on Echo direction charter

Legend: CORE

## Idea

Create a short Think-owned design packet that records the first proof boundary,
ownership split, and non-goals for the Think-on-Echo lane.

The packet should live in `docs/design/<cycle>/` when the cycle is pulled. It
should anchor to repo truth in Think, Echo, Continuum, and Wesley, but it
should not copy those worlds into Think.

## Why

The direction changes the center of gravity for Think. Without a local charter,
future work can drift into one of three wrong shapes:

- another broad `git-warp` repair project
- Echo learning Think-specific nouns
- Continuum becoming the home for Think's app schema

The charter should make the smallest executable hill obvious before any code
or schema is added.

## Scope

- State that Think owns app/domain nouns.
- State that Echo owns generic runtime dispatch and observation.
- State that Continuum owns shared runtime-boundary families and WARPspace
  coordination.
- State that Wesley owns generated helpers, codecs, registries, and witnesses.
- Name the first proof as `CaptureThought` plus `InspectThought`.
- Record what is intentionally out of scope for the first proof.

## Acceptance Criteria

- A design packet exists for the Think-on-Echo proof.
- The packet names the first witness command or test shape.
- The packet explicitly excludes remember, browse, migration, multi-mind UX,
  and `git-warp` exchange from the first proof.
- The packet references this backlog phase map.
