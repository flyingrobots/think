# 0019 Graph Versioning And Migration

Status: draft for review

## Sponsor

### Sponsor Human

A maintainer with real local `think` data who needs the graph model corrected without risking loss, corruption, or a confusing one-shot upgrade.

### Sponsor Agent

An agent using `think` through explicit CLI/JSON contracts who needs graph semantics to become more native and inspectable without having to special-case repo generations forever.

## Hill

If `think` corrects its graph model after shipping property-linked production data, both humans and agents can keep using existing repos safely while the system adds graph-native relationships, explicit versioning, and a clear migration path.

## Playback Questions

### Human Playback

- Can an existing local repo be upgraded without fear of losing thoughts or breaking normal usage?
- Does the migration story feel additive and reversible rather than destructive?
- Is there an explicit command or recovery path if migration was interrupted?

### Agent Playback

- Can mixed-generation repos be read through one honest contract during transition?
- Are graph semantics explicit enough that agents do not need archive-wide scraping to reconstruct relationships?
- Is versioning specific enough to support migration decisions without degenerating into per-node chaos?

## Non-Goals

This note does not:

- redesign `M4` browse UX
- introduce clustering, x-ray, or recommendation logic
- require hosted migration infrastructure
- require immediate deletion of legacy properties
- mandate per-edge bespoke version fields for every relationship in the graph

## Problem

`0009` defined a graph-native target model built around explicit edges:

- `capture --expresses--> thought`
- `capture --captured_in--> session`
- `artifact --derived_from--> thought`
- `artifact --contextualizes--> capture`

The current implementation only partially followed that model.

Today, most important relationships are still represented primarily as node properties:

- `thoughtId`
- `sessionId`
- `primaryInputKind`
- `primaryInputId`

That has two consequences:

1. the implementation drifted away from the intended graph doctrine
2. read paths such as `browse` still do too much brute-force application-side reconstruction

This note answers two questions directly:

1. should graph nodes and edges be versioned?
2. how do we fix the model without stranding current production data?

## Decision Summary

### 1. Yes, The Graph Model Should Be Versioned

But it should be versioned deliberately, not noisily.

The right unit of versioning is:

- repository graph model generation
- node-kind schema version
- derivation implementation version
- edge schema version only when the edge itself has inspectable payload or evolving semantics

It is not useful to treat every individual node or every plain edge as a snowflake with its own independent version doctrine.

### 2. Yes, Existing Data Must Be Migrated Additively

The migration path should:

- preserve all current data
- add missing graph-native relationships
- remain idempotent and resumable
- support mixed-generation repos during transition
- avoid rewriting raw capture content

## Versioning Model

## Repository-Level Graph Model Version

The repo should carry an explicit graph model generation marker.

Recommended field:

- `graphModelVersion`

Recommended initial generations:

- `1`: property-linked graph
- `2`: graph-native relationship model with explicit edges and compatibility fallbacks

This version answers:

- which relationship conventions the repo should be expected to contain
- which migration steps may still be pending
- whether reads may rely on edges, properties, or both

This version is about graph topology expectations, not about one artifact kind.

## Node-Level Schema Version

Node kinds should continue to carry `schemaVersion` when they already do so.

This remains appropriate for:

- `thought:<fingerprint>`
- `session:<session-id>`
- `artifact:<artifact-id>`

For raw capture nodes, the important compatibility boundary is still the capture payload contract itself.

The rule is:

- node `schemaVersion` answers what fields/payload shape this node kind uses
- repo `graphModelVersion` answers how nodes are expected to relate to one another

## Artifact Derivation Version

Artifacts should continue to carry:

- `deriver`
- `deriverVersion`
- `schemaVersion`

This is already the right contract for derived artifacts.

It answers:

- which implementation produced the artifact
- which artifact payload contract it follows

It should not be overloaded to mean repository graph topology version.

## Edge Versioning

Simple relationship edges do not need independent version metadata by default.

Examples:

- `expresses`
- `captured_in`
- `derived_from`
- `contextualizes`

For these edges, the normal rule should be:

- edge meaning is controlled by the named verb
- edge availability is controlled by `graphModelVersion`

Add an explicit edge version only when at least one of these becomes true:

1. the edge carries inspectable payload
2. the edge has evolving schema fields of its own
3. the edge becomes a first-class subject of migration or UI inspection

Recommended field when needed:

- `edgeSchemaVersion`

That keeps the model disciplined:

- version the graph
- version node kinds
- version artifact derivations
- version edges only when they are truly schema-bearing objects

## Current Production Reality

The current shipped repos should be treated as:

- graph model version `1`

Characteristics of version `1`:

- capture nodes store `thoughtId`
- capture nodes store `sessionId`
- artifact nodes store `primaryInputKind` and `primaryInputId`
- explicit relationship edges are absent or non-authoritative

This data is valid.

It is not “corrupt.”
It is simply an earlier graph shape that did not fully realize `0009`.

## Target Corrected Model

The corrected near-term target should be:

- graph model version `2`

Version `2` adds explicit named edges while preserving read compatibility.

Required relationships:

- `capture --expresses--> thought`
- `capture --captured_in--> session`
- `artifact --derived_from--> thought` when the artifact is thought-derived
- `artifact --contextualizes--> capture` when the artifact is capture-contextual

Legacy relationship properties may remain during the compatibility epoch:

- `thoughtId`
- `sessionId`
- `primaryInputKind`
- `primaryInputId`

They should be treated as:

- compatibility fields
- migration inputs
- optional caches during transition

They should stop being the only authoritative relationship representation.

## Migration Strategy

The migration path should be additive and staged.

## Phase 1: Dual-Read

All relevant read paths should be able to interpret either:

- explicit edges
- legacy relationship properties

Read preference during transition:

1. prefer graph-native edges when present
2. fall back to legacy properties when edges are missing

This must be true before any migration command is considered safe.

## Phase 2: Dual-Write

New writes during the compatibility epoch should emit:

- the new graph-native edges
- the legacy relationship properties needed for current compatibility

This keeps newly written repos from deepening the drift while avoiding a flag day.

## Phase 3: Explicit Local Migration

Provide an explicit migration/repair command.

Recommended shape:

- `think --migrate-graph`

Its job is to scan the current repo and add missing version-2 relationships.

Minimum migration work:

1. for each capture with `thoughtId`, add `expresses` edge to the thought node
2. for each capture with `sessionId`, add `captured_in` edge to the session node
3. for each artifact with thought-derived inputs, add `derived_from` edge
4. for each artifact with capture-context inputs, add `contextualizes` edge
5. record repo `graphModelVersion = 2` only when the required relationship pass completes successfully

This command must be:

- idempotent
- resumable
- safe to rerun

Interrupted migration should never invalidate the repo.

## Phase 4: Compatibility Epoch

After migration exists, the repo may remain in a mixed-compatible state for a while.

During this period:

- reads still support fallback
- writes still emit both edge and property relationships
- inspect surfaces may expose migration state if useful

This epoch should last until:

- local repos have a practical upgrade path
- read paths are no longer dependent on property-only reconstruction
- mixed-generation behavior is covered in tests

## Phase 5: Property Demotion

Only after the compatibility epoch should we consider reducing dependence on legacy relationship properties.

Even then, the first move should be:

- stop relying on them for primary reads

Not:

- delete them immediately

Deletion, if it ever happens, should be a later explicit cleanup decision, not part of the first corrective migration.

## Migration State And Provenance

Migration itself should be inspectable.

At minimum, record:

- current repo `graphModelVersion`
- migration tool version
- migration completion timestamp

Possible future expansion:

- migration operation nodes
- partial migration receipts

That heavier machinery is not required for the first repair pass.

## Read-Path Rules During Transition

The transition doctrine should be simple:

### 1. Reads Must Be Honest Across Mixed Repos

No user or agent should need to know whether a repo is:

- pre-migration
- mid-migration
- post-migration

to get a correct answer.

### 2. Graph-Native Reads Should Replace Brute-Force Reconstruction Gradually

The goal of migration is not only correctness of doctrine.
It is also to let `think` stop rebuilding relationship semantics through full archive scans and property inspection.

But the first corrective step should still be conservative:

- add edges
- prefer edges
- keep fallback

### 3. Performance Fixes Must Not Depend On a Perfect Migration First

The current `browse` startup problem is real, but it should not force a reckless graph rewrite.

The first-paint path should be improved independently:

- load only what is needed for the current thought
- lazy-load chronology drawer, jump corpus, and richer inspect data

Graph-native migration helps the architecture.
It does not excuse avoidable eager loading.

## Testing Implications

Before implementation, specs should cover at least:

1. version-1 repo reads still work
2. version-2 repo reads use edges correctly
3. mixed repos remain readable
4. migration is idempotent
5. interrupted migration can be rerun safely
6. new writes in the compatibility epoch emit both edges and fallback properties

Agent-facing specs should also ensure:

- inspect surfaces remain explicit about relationship semantics
- no JSON contract requires scraping legacy fields directly

## Recommended Next Slice

The next corrective slice should be:

1. tests-as-spec for graph versioning and migration
2. implementation of dual-read plus dual-write
3. explicit local migration command
4. only then broader graph-native browse/read refactors

That preserves the process:

- design first
- tests as spec second
- implementation third

## Bottom Line

Yes, the graph needs versioning.

But the right answer is not “version every node and edge independently forever.”
The right answer is:

- version the repository graph model
- keep node-kind schema versions
- keep artifact derivation versions
- version edges only when they become schema-bearing

And yes, we can fix the current shipped data safely.

The path is:

- dual-read
- dual-write
- explicit additive migration
- long enough compatibility epoch
- later cleanup only if it is still worth doing
