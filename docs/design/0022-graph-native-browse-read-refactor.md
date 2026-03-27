# 0022 Graph-Native Browse And Inspect Refactor

Status: draft for review

## Sponsor

### Sponsor Human

A person opening `think --browse` on a real archive who needs the shell to appear quickly and feel responsive without losing the reader-first shape already earned in `M4`.

### Sponsor Agent

An agent using `think` read surfaces through explicit CLI and JSON contracts who needs browse and inspect to rely on real graph semantics instead of whole-archive brute force and ad hoc reconstruction.

## Hill

If `think` refactors browse and inspect around explicit graph-native read paths, both humans and agents get the same honest relationships with materially faster browse bootstrap, while the repo stays migratable and mixed-generation handling remains explicit.

## Playback Questions

### Human Playback

- Does bare `--browse` open materially faster on the same local archive?
- Does the first screen still feel reader-first and unchanged in spirit?
- Does the refactor avoid trading startup speed for a noisier or less honest browse UX?

### Agent Playback

- Do browse and inspect still expose the same meaningful relationships through explicit command and JSON contracts?
- Does the implementation now rely on graph edges and traversal instead of archive-wide node scans where the graph already knows the answer?
- Can mixed-generation repos still be migrated deliberately instead of forcing agents to special-case half-implemented graph semantics?

## Non-Goals

This note does not:

- redesign browse UX again
- add x-ray, clustering, or recommendation behavior
- optimize every read surface in `think`
- replace the benchmark harness in [`0020-browse-bootstrap-benchmark.md`](./0020-browse-bootstrap-benchmark.md)
- remove compatibility properties immediately

## Problem

The current browse bootstrap path is still too expensive.

Today bare `--browse` does the wrong work before first paint:

- enumerate the whole archive
- read node properties one by one
- decode content for every recent capture
- sort the whole list
- only then open the TUI

That is why the committed `BEFORE` benchmark in [docs/benchmarks/browse-bootstrap-before.json](/Users/james/git/think/docs/benchmarks/browse-bootstrap-before.json) is still slow:

- median: `4152.16075 ms`

This is not primarily a Bijou problem.
It is a read-path problem.

More importantly, it is a doctrine problem.

`0009` defined a graph-native target, but our read path still behaves too much like:

- WARP as storage
- application code as the graph

That is backwards.

## Design Correction

The next browse/inspect refactor should make `git-warp` own relationship traversal where the graph already has the right semantics.

Application code should still own:

- product-facing presentation
- filtering and ranking policy
- reader-first UX choices

But it should stop reconstructing obvious graph relationships through archive-wide scans.

## Scope

This slice is about the browse and inspect hot paths only.

It should fix the reads that matter most for:

- first browse paint
- chronology neighbors
- session-context reads
- direct inspect receipts that are currently reconstructed too expensively

It should not try to “solve all read queries” in one pass.

## Read Paths To Fix

### 1. Browse Bootstrap

First paint should not depend on `listRecent()` over the entire archive.

Bare `--browse` should be able to open from a graph-native anchor:

- newest capture
- current capture metadata and text
- immediate chronology neighbors
- immediate session context

The shell should then lazy-load anything wider:

- thought-log drawer contents
- jump corpus
- richer inspect data not needed for first paint

### 2. Browse Traversal

Chronology traversal should become graph-native rather than “whole archive plus array indexing.”

Session traversal should rely on:

- explicit session membership edges
- local traversal from the current capture
- session-local sorting only when needed

### 3. Inspect Read Path

`inspect` should stop finding direct reflect descendants by scanning all reflect entries.

The graph should carry explicit operational relationships so inspect can ask the graph directly:

- what was seeded by this capture?
- what response was produced in this reflect session?

## Graph-Native Read Model

This slice should introduce a small set of new read-critical relationships.

### Chronology

Required additions:

- `meta:graph --latest_capture--> capture`
- `capture(newer) --older--> capture(older)`

This is enough to support:

- newest-entry bootstrap
- older / newer movement
- bounded chronology traversal without archive scans

One directional chronology edge is enough.
The reverse direction can be obtained through incoming traversal.

### Reflect Receipts

Required additions:

- `reflect_session --seeded_by--> capture`
- `reflect_entry --produced_in--> reflect_session`
- `reflect_entry --responds_to--> capture`

This is enough to support:

- inspecting direct reflect descendants without scanning all reflect entries
- clearer operational provenance for reflect outputs

### Existing Session And Derivation Edges

The refactor should continue to use the already-intended graph-native edges:

- `capture --captured_in--> session`
- `capture --expresses--> thought`
- `artifact --derived_from--> thought`
- `artifact --contextualizes--> capture`

The point is not to invent a second ontology.
The point is to complete the read-critical edge set the product now actually needs.

## Versioning Decision

This refactor should advance the repo graph model again.

Recommended new generation:

- `graphModelVersion = 3`

Meaning:

- `v1`: property-linked graph
- `v2`: explicit derivation and session/canonical relationship edges
- `v3`: graph-native browse/inspect read edges and operational reflect edges

This is justified because the expected topology for core read behavior changes again.

It should not be hidden.
It should use the same migration doctrine already approved in:

- [`0019-graph-versioning-and-migration.md`](./0019-graph-versioning-and-migration.md)
- [`0021-graph-migration-gating.md`](./0021-graph-migration-gating.md)

## Migration Strategy

Migration to `v3` should stay additive.

### Dual-Read During Transition

Read preference:

1. prefer `v3` browse/inspect edges when present
2. fall back to `v2` property/scan behavior only where needed
3. do not strand mixed-generation repos before migration is proven

### Dual-Write During Transition

New writes should emit the new read-critical edges as they are created:

- latest-capture pointer maintenance
- chronology edge maintenance
- reflect operational edges

Compatibility properties may remain during the transition.

### Explicit Migration

`think --migrate-graph` should backfill:

- latest-capture pointer
- chronology edges
- reflect operational edges
- `graphModelVersion = 3`

The migration should remain:

- idempotent
- resumable
- additive

## Browse Bootstrap Rules

The first frame should require only:

1. graph metadata / latest-capture anchor
2. current capture props + content
3. one-hop chronology neighbors
4. session context for the current capture

It should not require:

- full archive enumeration
- full recent list materialization
- jump-palette corpus build
- full inspect preload

Any of those may happen later and on demand.

## Inspect Rules

`inspect` may still assemble a multi-part view, but it should prefer graph-native receipts over archive scans.

For direct reflect descendants, the graph should answer:

- which reflect session was seeded by this capture
- which reflect entries respond to this capture

The inspect surface should stay honest:

- no inferred receipts without edges
- no hidden fallback pretending to be explicit provenance

## Query And Traversal Posture

The implementation should favor `git-warp` query and traversal APIs for relationship reads.

Near-term examples:

- `neighbors()` for one-hop chronology and direct receipt discovery
- `query().match(...).incoming(...)` / `outgoing(...)` for session and receipt reads

The point is not to make every product concern a raw graph query.

The point is:

- let the substrate answer graph questions
- let the app answer product questions

## Design Constraints

### Keep Browse Reader-First

This refactor must not change the earned browse feeling:

- the current thought still dominates the screen
- metadata remains useful, not noisy
- faster startup must not come from collapsing the UI into less information

### Keep Agent Parity

Any relationship the TUI uses for:

- chronology traversal
- session traversal
- reflect receipts

must remain available through explicit CLI / JSON contracts.

### Keep The Benchmark Honest

The success comparison for this slice should use the existing browse bootstrap harness.

That means:

- do not change the benchmark definition mid-slice
- capture `AFTER` only when the browse bootstrap path is actually changed

## Success Criteria

This slice is successful when:

- browse bootstrap no longer requires whole-archive recent materialization before first paint
- inspect no longer scans all reflect entries to find direct receipts
- the repo has a clear graph-model upgrade path to the new read-critical edges
- the benchmark captures a meaningful `AFTER` result against the existing committed `BEFORE` baseline

## Next Move

After this design note:

1. write failing specs for the graph-native browse/inspect read path
2. pin the `v3` migration behavior
3. implement the browse/inspect refactor
4. capture and commit the `AFTER` browse bootstrap benchmark
