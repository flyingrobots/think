---
id: CORE_think-echo-phase-2-runtime-roundtrip
blocks:
  - CORE_think-echo-phase-3-experimental-product-path
  - CORE_think-echo-phase-4-read-observers
  - CORE_think-echo-phase-5-migration-and-sibling-exchange
blocked_by:
  - CORE_think-echo-phase-1-app-contract
  - CORE_think-echo-toolchain-capability-probe
---

# CORE - Phase 2 - Echo runtime round-trip proof

Legend: CORE

## Idea

Build the first executable witness that Think can capture and inspect one
thought through Echo.

This should be a test, example, or proof harness that runs outside the current
production capture path.

## Witness Shape

The proof should:

0. Run `npm run echo:probe -- --json` and require
   `ready_enough_for_phase_2`.
1. Build a `CaptureThought` input through generated or minimally generated
   contract helpers.
2. Dispatch the canonical intent through Echo.
3. Receive admission evidence for the capture.
4. Build an exact `InspectThought` observation by entry id or coordinate.
5. Receive a `ReadingEnvelope` or equivalent Echo observation artifact.
6. Verify the reading posture is complete.
7. Decode the payload into a Think-owned `ThoughtEntry`.
8. Assert that raw text and capture metadata survived the round trip.

## Why

This is the first point where the north star becomes engineering fact. Until
this passes, the Echo direction is still architecture discussion rather than a
usable migration path.

## Constraints

- Do not switch the CLI, MCP server, macOS app, or default store to Echo.
- Do not require existing `~/.think/*` minds to migrate.
- Do not depend on `git-warp` in the hot proof path.
- Do not hand-roll runtime bytes if the current Wesley/Echo toolchain can
  generate the needed helper surface.
- If generation is not ready, write the smallest temporary adapter and log the
  missing generated cut as follow-on debt.

## Acceptance Criteria

- One reproducible command proves raw capture plus exact inspect through Echo.
- The proof asserts decoded Think payload fields, not only runtime success.
- The proof records admission/read evidence in a way that can be inspected.
- The production Think capture path remains unchanged.
- Follow-on gaps for Wesley/Echo generation are recorded if any temporary
  adapter is used.
