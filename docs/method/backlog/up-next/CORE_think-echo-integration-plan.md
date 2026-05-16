---
id: CORE_think-echo-integration-plan
blocks:
  - CORE_think-echo-phase-2-runtime-roundtrip
blocked_by:
  - CORE_think-memory-data-model
  - CORE_think-echo-phase-1-app-contract
---

# CORE - Think Echo integration plan

Legend: CORE

## Idea

Define how Think will integrate with Echo after the memory model and GraphQL
contract are pinned.

The design packet lives at:

```text
docs/design/0069-think-echo-integration-plan/think-echo-integration-plan.md
```

## Why

The Echo runtime witness needs an architecture target before code starts. The
integration path must keep Think product workflows behind a Think-owned memory
port, keep Echo as a generic causal substrate, and keep `git-warp`
authoritative until parity and migration evidence are real.

## Acceptance Criteria

- [x] Define the `MemoryRuntimePort` boundary.
- [x] Define the Echo adapter layers and generated-helper boundary.
- [x] Include capture and inspect sequence diagrams.
- [x] Define rollout phases from capability probe through default cutover.
- [x] Define verification gates and failure handling.
- [x] Keep production capture unchanged until the runtime witness passes.
