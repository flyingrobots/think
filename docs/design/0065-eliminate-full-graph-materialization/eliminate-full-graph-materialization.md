---
title: "Eliminate full graph materialization anti-pattern"
legend: "CORE"
cycle: "0065-eliminate-full-graph-materialization"
source_backlog: "docs/method/backlog/asap/CORE_eliminate-full-graph-materialization.md"
---

# Eliminate full graph materialization anti-pattern

Source backlog item: `docs/method/backlog/asap/CORE_eliminate-full-graph-materialization.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

Zero calls to `getNodes()` or `getEdges()` in Think. All reads
use the worldline query API. Capture works on repos of any size.

## Playback Questions

### Human

- [ ] Can the codex mind (317MB) capture without buffer errors?

### Agent

- [ ] Does `grep -r 'getNodes\|getEdges' src/` return zero hits?
- [ ] Does migration use worldline queries instead of full scan?
- [ ] Does enrichment use worldline queries instead of full scan?
- [ ] Does annotation lookup use edge traversal instead of full scan?
- [ ] Do all existing tests pass?

## All postures

Not applicable — internal refactor for correctness.

## Non-goals

- Not changing the migration logic — just how it reads the graph

## Design

### Migration (migrations.js)

Replace:
```js
const nodes = await graph.getNodes();
const edges = await graph.getEdges();
```

With targeted queries per node kind:
```js
const worldline = app.worldline();
const captures = await worldline.query().match('entry:*').where({ kind: 'capture' }).run();
const sessions = await worldline.query().match('reflect:*').run();
const meta = await worldline.getNodeProps('meta:graph');
```

Then check for missing edges using `.outgoing()` / `.incoming()`
traversal on specific nodes instead of building a full edge Set.

### Enrichment (runner.js)

Replace `getNodes()` + `getEdges()` with:
```js
const captures = await listEntriesByKind(read, 'capture');
// Already uses query API internally
```

For existing receipt/edge checks, query specific patterns:
```js
const receipts = await worldline.query().match('artifact:*').where({ kind: 'auto_tags' }).run();
```

### Annotation lookup (queries.js)

Replace `read.view.getEdges()` with incoming edge traversal:
```js
const annotations = await worldline.query()
  .match(entryId)
  .incoming('annotates')
  .run();
```

### Files to modify

- `src/store/migrations.js` — most critical (causes capture crash)
- `src/store/enrichment/runner.js` — 4 violations
- `src/store/queries.js` — 1 violation

## Backlog Context

Think calls `getNodes()`, `getEdges()`, and iterates full prop maps
in multiple places. This dumps the entire WARP graph into memory,
violating the git-warp GUIDE's prescribed read patterns (worldline
query API with match/where/outgoing/incoming).

On a 317MB codex repo, this exceeds the 10MB buffer limit and
crashes capture.

## Violations

| File | Anti-pattern |
|------|-------------|
| `src/store/migrations.js:14-25` | `graph.getNodes()` + `graph.getEdges()` + full props scan into Map |
| `src/store/enrichment/runner.js:20` | `read.view.getEdges()` |
| `src/store/enrichment/runner.js:24` | `read.view.getNodes()` |
| `src/store/enrichment/runner.js:62` | `read.view.getNodes()` again |
| `src/store/enrichment/runner.js:214-215` | `read.view.getEdges()` + `read.view.getNodes()` |
| `src/store/queries.js:293` | `read.view.getEdges()` for annotation lookup |

## Correct pattern (from git-warp GUIDE)

```js
const worldline = app.worldline();
const results = await worldline.query()
  .match('entry:*')
  .where({ kind: 'capture' })
  .run();
```

Use `.outgoing()` / `.incoming()` for edge traversal instead of
loading all edges and filtering in JS.

## Priority

Critical — blocks capture on large repos. The codex mind (317MB)
cannot capture because migration triggers full materialization.
