---
id: CORE_think-echo-phase-1-app-contract
blocks:
  - CORE_think-echo-phase-2-runtime-roundtrip
blocked_by:
  - CORE_think-echo-phase-0-direction-charter
---

# CORE - Phase 1 - Think memory app contract

Legend: CORE

## Idea

Author the smallest Think-owned contract family needed for a raw capture and
exact inspect round trip.

Update: `contracts/think-memory.graphql` now expresses the pinned data model in
`docs/design/0068-think-memory-data-model/think-memory-data-model.md` for the
Phase 2 proof. The GraphQL file is still a contract expression, not semantic
source truth.

The likely first file is:

```text
contracts/think-memory.graphql
```

The family should define only the nouns needed for the first proof:

```text
mutation CaptureThought(input: CaptureThoughtInput): CaptureThoughtResult
query InspectThought(entryId: ID!): ThoughtEntry
```

Equivalent names are acceptable if the design packet chooses them.

## Why

Think's domain model is currently spread across JS store code, CLI/MCP shapes,
and read surfaces. A Think-authored app contract gives the Echo proof a typed
boundary without pushing application nouns into Echo or Continuum.

## Model Constraints

The first model should stay boring:

- `entryId`
- content digest or `thoughtId`
- raw text
- captured timestamp
- ingress/provenance fields already known by Think
- `mindId`, defaulting to `default`
- optional `actorId` or writer identity if the proof needs it

Do not add tags, embeddings, summaries, ranking fields, browse windows, or
reflection outputs to the first contract.

## Acceptance Criteria

- [x] A Think-owned GraphQL contract file exists.
- [x] The contract supports one capture mutation and one exact inspect query
  using model-derived fields.
- [x] The provisional contract names `mindId` explicitly, even if only
  `default` is used.
- [x] Generated-artifact locations are decided but generated output is not treated
  as semantic source truth.
- [x] No Echo or Continuum schema is modified to add Think domain nouns.
- [x] The contract exposes `ThoughtContent`, `ThoughtCapture`,
  `ThoughtProvenance`, and `CausalRef` from the pinned model.

## Evidence

- `contracts/think-memory.graphql`
- `test/ports/think-echo-contract.test.js`
- `scripts/think-echo-capability-probe.mjs`
