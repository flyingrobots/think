# Phase 1: Immutable Memory Entities with Derived Retrieval Optics

Status: ready to execute — supersedes the page/read-model storage shape

Governed by: `git-warp` `docs/READINGS_AND_OPTICS.md`

Narrative background: `~/agy-readings/think-warp-data-model.md`

**This plan is subordinate to `READINGS_AND_OPTICS.md`. Where they disagree, the
doctrine wins.** Section references below (§N) are to that document.

## Why

A census of a real Think store found 274 patches touching **4 nodes**, **0 edges**,
272 `PropSet` + 2 `NodeAdd`. Memories are not entities — each is a JSON object embedded in a
page node's property value, and every capture rewrites the whole page. Consequences, measured:

| | |
|---|---|
| `"probe write two"` (15 bytes) | emitted a **33,624-byte** patch (~2,200×) |
| page 00000112, 23 appends | 409.3 KiB total, Θ(appends²) |
| `--limit=1` / `--limit=50` | **both 5,267 git subprocesses** |
| fresh / light / heavy store | 79 / 232 / **5,267** spawns |
| materialised state | 16.4 MiB; one object 8,568,034 B vs a 5 MiB decode ceiling |
| recovery | `E_INTERNAL: CBOR decode rejected` — store unrecoverable |

Diagnosis: a read model was stored inside the event log instead of derived from it. The log
records cache updates, not facts, so every substrate capability defined over facts evaporates.
Narrative writeup: `~/agy-readings/think-warp-data-model.md`.

## Corrections carried into this rewrite

An earlier draft of this plan violated the doctrine in three ways. Recorded because the errors
are instructive:

1. **"The trie is the primary structure."** Wrong — §7 and §9. Indexes are *derived optics over
   entities*. Immutable memory entities are the primary facts; any trie is a rebuildable optic.
2. **"Today's memories is the cone of one day node."** A category error. `edgesFrom(bucket)` and
   range scans answer **membership**; `patchesFor(id)` answers **causation**. Graph descendants
   are not a container's backward cone. See the new *Provenance and diagnostics* section.
3. **"`edge.add` is a prerequisite."** Wrong, and it inflated risk. A range scan over
   `entry:<sortKey>` needs no edges. Edges are required for *relationships*, not for
   entity-per-node.

A fourth correction, from review: **context indexing is unsolved.** `remember` selects on
cwd/remote/branch. No amount of temporal ordering bounds a sparse-context miss. Sizing that on
today's capture density (p50 = 5 entries/hour) is the trap the doctrine warns about —
*"today's hour-bucket is tomorrow's hot page"* (§9).

---

## Phase 1A — immutable memory entities

No trie. No pages. No edges required.

Each capture emits exactly one dependency-pure patch (§4):

```text
PATCH — intrinsic memory fact
  NodeAdd entry:<sortKey>
    kind, sortKey, createdAt, bodyHash | body,
    ambientCwd, ambientGitRoot, ambientGitRemote, ambientGitBranch,
    schemaVersion

  reads:  {}
  writes: { entry:<sortKey> }
```

The complete intrinsic payload goes in the `NodeAdd`. No follow-up `PropSet` — a capture that
creates an empty shell and fills it by property writes is already weaker than the contract,
even if each property is written once. Under this shape and only this shape, the syntactic
footprint is **exact by construction** (§8) and the cone is a singleton.

Large bodies stay content-addressed (§9): store `{bodyHash, sortKey, meta}` on the node so
entity patches stay far below any decode ceiling regardless of future field drift.

**Delete, do not rehabilitate:**
- the page nodes — they are containers in the log (§5, §7). "Ordering metadata over entry ids"
  is still an id-array in a property.
- `read_model:v19:index:capture` — a global counter updated on every append (136 of 274 writes,
  49.6% on one node). Its cone is the history of the store by construction (§10).

Critical files: `src/store/capture.js`, `src/store/native-index.js`,
`src/store/native-runtime.js`, `src/generated/think-memory.generated.js`.

**Acceptance:** one fresh id written; empty read set; no pre-existing location modified; patch
size proportional to the memory; `patchesFor(entry)` returns an exact singleton cone; capture
#100,000 costs what capture #100 costs.

## Phase 1B — ordered range reads

Recent-N is a prefix range over sortable ids — no index node exists (§9).

`sortKey` is already embedded in every entry id, so ordering is derivable without traversal.
**Specify the tiebreaker explicitly**: a millisecond timestamp alone is not collision-safe.
Options: `(timestamp, writerId, counter)` or `(timestamp, random)` — pick one, document it as
the total-order policy, and version it.

Point reads stop scanning pages: `readIndexedMemoryDocument` /`findDocumentAcrossKinds`
(`native-index.js:78-88, 363-373`) currently walk pages linearly per kind.

**Acceptance:** point read is a point read; recent-N stops after enough candidates; global
recent-N cost is flat as history grows; ordering deterministic under concurrent writers.

## Phase 1C — semantic relationships

Add an `edge.add` intent to Think's generated vocabulary — it currently exposes `node.add` plus
three `property.set` variants and no edge intent. git-warp supports edges
(`PatchBuilder.addEdge` indexes edge keys into provenance); this is a Think-side gap.

Each relationship is its own immutable fact in its own patch (§4 — do not bundle into the
capture patch, or the intrinsic cone stops being a singleton):

```text
PATCH — relationship fact
  EdgeAdd session:<id> -> entry:<id>
```

Five relationships are currently field-encoded and read by `getSingleNeighborId`
(`src/store/runtime.js:260`): `sessionId`, `seedEntryId`, `targetEntryId`, `primaryInputId`,
and `previousKindId`.

**Migrate each deliberately**, specifying authority, direction, cardinality, concurrency
semantics, and provenance implications. **Rename `previousKindId`** rather than preserving its
misleading authority — §6 forbids prev-pointers as authoritative order, and the name invites
exactly that. Candidates: `observedAfter`, `writerObservedPredecessor`, `sessionPredecessorHint`.
Archaeology recovers shapes, not laws.

## Phase 1D — context optics *(the unsolved one)*

`remember` filters on ambient context, then orders by recency. Temporal structure gives ordering
and early termination; it does **not** give selectivity. This query breaks the flat-cost promise
without a context index:

```text
five memories from branch: forgotten-experiment-from-2024
```

The engine may scan months before finding five, or before discovering there are none. §9 is
explicit that an unbounded kind scan "becomes the O(N) read reborn under a different name."

Build rebuildable ordered access paths keyed on the actual predicates — `gitRemote`,
`gitBranch`, `gitRoot`, `cwd`, `session` — and merge a small number of ordered candidate
streams under the existing relevance tiers (`src/store/remember.js:129-139`).

**State the guarantee honestly at each stage:**

| Stage | Global recent-N | Contextual recent-N |
|---|---|---|
| after 1B | bounded by ordered range access | bounded batches with early termination; **proportional to history on sparse/miss** |
| after 1D | bounded | proportional to matching context stream + result count |

Acceptance criterion 2 is **not** satisfied until 1D lands. Do not claim it earlier.

## Phase 1E — temporal optic *(optional, only if measured)*

Only after 1B measurement proves direct range access insufficient. If built:

- immutable bucket nodes + `EdgeAdd` membership — **never** `PropSet` a bucket (§5)
- declare `sourceFrontier`, `opticVersion`, `sourceSemanticDigest`, `rebuildable: true`,
  `authoritative: false`, `bucketPolicy`
- deleting it must not remove or alter any memory fact

**Open doctrinal question, resolve before building:** §7 says derived data cannot live in the
patch log; §9 permits a materialised trie of bucket nodes plus membership edges without saying
where it lives. Bucket membership is mechanically regenerable from `sortKey`, therefore derived,
so §9 currently reads as an unstated exception to §7. Resolve in the doctrine first — the clean
form is that a materialised trie remains a non-authoritative optic in a disposable namespace
bound to its source frontier.

---

## Independent of Phase 1

**Stop over-fetching.** `CAPTURE_READ_MODEL_LIMIT = 500` (`src/store/queries.js:47`) is passed
to the page selector instead of the caller's limit; `recentIndexPageNumbers`
(`native-index.js:260`) then reads 9 pages instead of 1. Measured **4.9×** (5,264 → 1,065
spawns). Ships without migration. Note this disappears entirely once pages are deleted.

**Batch the reads.** Two one-process-per-object bugs, ~50/50 of spawn time:
- git-cas `GitPersistenceAdapter.js:243` `readBlobStream` bypasses the session pool that
  `readBlob` (line 185) uses via `#sessions.supports('catFile')`. The session is already open —
  `cat-file --batch-command --buffer` is spawned exactly once alongside 526 one-shot reads.
  Design doc `0052-persistent-git-object-sessions` measured this pattern at **225 → 1**.
- git-warp `GitTimelineHistoryAdapter.ts:92` spawns one `git show -s` per commit, 527 per page
  read, each commit fetched twice.

**Checkpoints.** git-warp branch `fix/default-checkpoint-policy` (1 commit, 7,299 tests pass,
not pushed) defaults `checkpointPolicy` to `{ every: 64 }` with `null` as explicit opt-out.
Necessary but insufficient: the trigger fires from `_onMaterialized`, which Think's
lane/bounded-reader path never calls (verified — zero probe output). The invariant that matters
is *the tail stays bounded under Think's real execution paths*; the mechanism is open. Checkpoint
failures must be visible — `RuntimeHost.ts:894` `catch { /* non-fatal */ }` swallows them with
no logging while the sibling catch above logs a warning.

---

## Acceptance criteria

1. `--limit=1` performs measurably less physical work than `--limit=50` (today: identical).
2. Global recent-N cost does not grow with total store size.
3. Contextual misses and sparse contexts have an explicit bounded access path — **requires 1D**.
4. Every capture is dependency-pure: empty read set, exactly one fresh id, complete payload.
5. `patchesFor(entry)` returns an **exact** intrinsic cone; relationships independently addressable.
6. One capture's bytes are proportional to its payload, not to prior history.
7. No page, bucket, counter, or other shared mutable location is rewritten.
8. Any derived optic can be deleted and reconstructed from a declared frontier.
9. Memory contents and authoritative relationships equivalent across migration, under a defined
   **Think-level semantic projection digest** (not merely "canonical digest").
10. Checkpoint tail bounded under the exact production reader and writer paths.
11. No independently decoded object trends toward the decode ceiling.
12. `warp census` passes §12's six properties — the six Think currently fails.

## Verification harness (built and validated)

- **Spawn counting** — PATH shim logging every `git` invocation. `@git-stunts/plumbing`
  sanitises the child environment, so the log path must be baked into the shim, not passed by
  env var (an env-var version silently reported 4 calls instead of 5,267).
- **JS attribution** — `node --require` preload wrapping `child_process.spawn`, aggregated by
  **innermost** `node_modules` segment (`git-cas` is nested under `git-warp`; first-segment
  regexes misattribute it).
- **Footprint census** — decode every patch body, tally `reads`/`writes`. This found the root
  cause and required no inference.
- **Optic drill** (proposed, CI): populate → build every optic → delete every optic → rebuild →
  assert identical results and digests. *If a test is afraid to delete the index, the index is
  authority.*
- All experiments ran against a store copy; the live store was only read.

## Open

1. **Scope order** — the 4.9× over-fetch fix and read batching ship without migration and give
   codex relief now; Phase 1A deletes the pages that the over-fetch fix patches. Sequence
   deliberately rather than doing both.
2. **The codex store** — unrecoverable, +2 replay commits per write, degrading while this is
   read. Rebuild (original retained as backup) is likely the same job as the 1A migration.
3. **§7/§9 tension** in the doctrine — see Phase 1E.
4. Substrate affordances worth requesting (§11): a `captureEntity()` API structurally incapable
   of reading graph state or writing a second id; `warp census` as a first-class command;
   capture-shape, amplification, hot-node and decode-boundary lints.
