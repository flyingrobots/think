---
title: "Think on Echo contract proof"
legend: "CORE"
cycle: "0067-think-echo-contract-proof"
source_backlog: "docs/method/backlog/asap/CORE_think-echo-contract-proof.md"
---

# Think on Echo contract proof

Source backlog item: `docs/method/backlog/asap/CORE_think-echo-contract-proof.md`
Legend: CORE

## Sponsors

- Human: sponsored human user
- Agent: sponsored agent user

## Hill

Think can capture and inspect one thought as a Continuum application hosted by
Echo, without moving Think product nouns into Echo and without replacing the
current production store path.

## Ownership Split

Think owns:

- application/domain nouns such as thought, mind, capture provenance, inspect,
  remember, browse, and session;
- the memory model in
  `docs/design/0068-think-memory-data-model/think-memory-data-model.md`;
- `contracts/think-memory.graphql` as a generated-contract expression of that
  model;
- product policy and user-facing workflows;
- the adapter that chooses when an Echo-backed proof path is used.

Echo owns:

- generic runtime dispatch and observation;
- intent admission evidence;
- scheduler and witnessed causal substrate behavior;
- `ReadingEnvelope` and generic observation artifacts.

Continuum owns:

- shared runtime-boundary families;
- causal-history vocabulary that can be spoken by Echo, future Think runtimes,
  and sibling runtimes;
- WARPspace coordination when the proof grows beyond a single local runtime.

Wesley owns:

- generated helpers, codecs, registries, operation ids, and witnesses derived
  from Think-authored contracts;
- the compiler boundary that keeps GraphQL app contracts out of Echo core.

## First Witness

The first witness is deliberately small, but it must follow the pinned data
model:

```text
CaptureThought -> Echo dispatch_intent(...)
InspectThought -> Echo observe(...)
ReadingEnvelope + decoded ThoughtEntry
```

The reproducible command for this slice is:

```sh
npm run echo:probe -- --json
```

That command checks the local sibling Echo/Wesley toolchain and verifies that
`contracts/think-memory.graphql` can generate Echo-facing Rust helper output.

## Playback Questions

### Agent

- [x] Does Think have a local app contract for raw capture and exact inspect?
- [x] Does the contract name `mindId` before multi-mind migration work starts?
- [x] Does Think have a local probe for Echo/Wesley readiness?
- [x] Does Think have a data model before the runtime proof?
- [x] Has the GraphQL contract been revised from that data model?
- [ ] Does a runtime round trip dispatch and observe one thought through Echo?
- [ ] Does the production CLI stay on the existing store until the proof works?

## Non-goals

- Do not switch the CLI, MCP server, macOS app, or default store to Echo in this
  phase.
- Do not migrate existing `~/.think/*` minds.
- Do not make Echo or Continuum own Think-specific schema nouns.
- Do not include remember, browse, annotations, reflection, tags, embeddings,
  summaries, ranking, migration, or sibling exchange in the first proof.

## Backlog Context

This packet covers Phase 0 and anchors Phase 1 from the Think-on-Echo backlog
lane. The data model packet now sits before Phase 2. Phase 2 remains the first
runtime proof: a separate witness must dispatch `CaptureThought`, observe
`InspectThought`, inspect the `ReadingEnvelope`, and decode a Think-owned
`ThoughtEntry` whose fields are defined by the model, not by ad hoc GraphQL.
