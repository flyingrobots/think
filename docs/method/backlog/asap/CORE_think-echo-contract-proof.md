---
id: CORE_think-echo-contract-proof
blocks:
  - CORE_think-echo-phase-0-direction-charter
  - CORE_think-echo-phase-1-app-contract
  - CORE_think-echo-phase-2-runtime-roundtrip
  - CORE_think-echo-phase-3-experimental-product-path
  - CORE_think-echo-phase-4-read-observers
  - CORE_think-echo-phase-5-migration-and-sibling-exchange
blocked_by: []
---

# CORE - Think on Echo contract proof

Legend: CORE

## Idea

Turn the Think-on-Echo north star into an executable backlog lane.

Think remains the product boundary for capture, remember, browse, inspect,
minds, sessions, and user workflows. Echo becomes the first active runtime path
for the new proof. Continuum provides the shared causal-history boundary and
runtime family vocabulary. Wesley provides generated helpers, codecs,
registries, and witnesses.

The first proof must make one sentence true:

```text
Think can capture and inspect a thought as a Continuum application on Echo.
```

## Why

The current Think architecture still orbits a local Git/`git-warp` substrate.
That path has real value and must protect existing minds, but it is also where
the current pressure is concentrated: large repos, checkpoint repair,
dependency-version ambiguity, graph bottlenecks, and repo-directory-based mind
identity.

This lane keeps the existing product safe while proving a cleaner runtime seam
outside the hot CLI path.

## Phase Map

1. **Phase 0 - Direction charter**
   - Record the proof boundary and non-goals in Think.
   - Decide which repo owns each noun before code moves.
2. **Phase 1 - App contract**
   - Add a small Think-authored GraphQL family for raw capture and exact
     inspect.
3. **Phase 2 - Runtime round trip**
   - Use generated or minimally generated helpers to dispatch one capture
     through Echo and inspect it back with a complete reading.
4. **Phase 3 - Experimental product path**
   - Decide how the proof enters Think surfaces without replacing the current
     store prematurely.
5. **Phase 4 - Read observers**
   - Extend the proof toward recent, remember, browse, and first-class mind
     identity.
6. **Phase 5 - Migration and sibling exchange**
   - Move old minds and future `git-warp` participation into explicit replay,
     import/export, or witnessed suffix exchange.

## Acceptance Criteria

- [x] Each phase has its own backlog card.
- [x] Phase 1 and Phase 2 are small enough to pull into a single METHOD cycle.
- [x] No card requires changing the production capture path before the round-trip
  proof exists.
- [x] Existing `git-warp` repair work remains framed as data rescue and continuity,
  not the long-term architecture.
- [x] The first executable witness is raw capture plus exact inspect, not remember,
  browse, migration, or cross-runtime sync.

## Current Evidence

- Phase 0 charter: `docs/design/0067-think-echo-contract-proof/think-echo-contract-proof.md`
- Phase 1 contract: `contracts/think-memory.graphql`
- Toolchain probe: `npm run echo:probe -- --json`

## Non-Goals

- Do not remove `git-warp` from Think in this lane.
- Do not migrate existing `~/.think/*` minds before the new proof works.
- Do not put Think domain nouns into Echo or Continuum shared schemas.
- Do not make the CLI use Echo by default until the proof has its own evidence.
