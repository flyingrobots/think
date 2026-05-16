---
id: CORE_think-memory-data-model
blocks:
  - CORE_think-echo-phase-2-runtime-roundtrip
blocked_by: []
---

# CORE - Think memory data model before Echo round trip

Legend: CORE

## Idea

Pin the Think memory data model before proving the Echo runtime round trip.
GraphQL must express the model, not become the source of domain nouns.

The design packet lives at:

```text
docs/design/0068-think-memory-data-model/think-memory-data-model.md
```

## Why

The first Echo proof should not succeed against an accidental schema. Think
needs a model that answers what a thought is, who owns it, what is immutable,
what is derived, what is queryable, what carries causal provenance, and what is
safe to expose through `InspectThought`.

## Acceptance Criteria

- [x] Define `Mind`, `ThoughtEntry`, `ThoughtContent`, `ThoughtCapture`,
  `ThoughtInspection`, `ThoughtCursor`, `ThoughtQuery`,
  `ThoughtProvenance`, `ThoughtTags`, and `ThoughtFacets`.
- [x] Include flow, sequence, class, and entity-relationship diagrams.
- [x] Define the minimum Phase 2 model fields.
- [x] Name what is immutable, derived, queryable, causal, and safe to inspect.
- [x] Add a migration plan from the current `git-warp` graph to Echo.
- [x] Mark the current GraphQL contract as provisional until it is revised
  against the model.

## Follow-up

Phase 1 GraphQL should be revised from the data model before Phase 2 dispatch
and observe code is written.
