---
id: CORE_think-echo-toolchain-capability-probe
blocks:
  - CORE_think-echo-phase-2-runtime-roundtrip
blocked_by:
  - CORE_think-echo-phase-1-app-contract
---

# Think lacks a local Echo/Wesley capability probe

The Think-on-Echo round-trip proof depends on practical toolchain facts:

- can Wesley compile the Think app contract shape we need?
- can the generated or minimally generated helpers pack the capture intent?
- can Echo host the generic dispatch/observe path for that contract?
- what sibling repo, binary, or generated artifact assumptions are required?

Right now those answers live in cross-repo memory and manual inspection rather
than a local Think probe.

## Why

Phase 2 should fail for product reasons, not because the first engineer has to
rediscover the current Wesley/Echo integration shape. A small capability probe
keeps the round-trip proof honest and prevents hidden sibling checkout
assumptions from becoming folklore.

## Acceptance Criteria

- Think has a command, script, or test helper that reports the available
  Wesley/Echo contract-hosting capability in JSON.
- The probe distinguishes "generator unavailable", "Echo runtime unavailable",
  "generated target unsupported", and "ready enough for Phase 2".
- The probe records exact paths or versions for any sibling checkout or local
  binary it uses.
- Phase 2 can invoke the probe or documents why it replaced the probe with a
  stronger witness.
- Missing capabilities become explicit follow-on backlog items, not inline
  TODO comments in the round-trip proof.
