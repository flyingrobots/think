# M4 Retrospective: Graph-Native Browse Read Refactor

Date: 2026-03-28
Status: complete

## Slice Summary

This slice finished the broader graph-native browse/read refactor that began with the `v3` read-edge substrate.

Delivered behavior:

- product read paths now use `WarpApp -> worldline() -> observer(...)` for graph traversal and query semantics
- browse bootstrap no longer depends on whole-archive `core()` scans
- browse/read startup now reuses the same long-lived graph handle during the shell session
- checkpoint policy is enabled with `every: 20`
- the official synthetic browse benchmark now has both committed `BEFORE` and `AFTER` artifacts

Implementation commits:

- `42badbb` - `Reuse browse graph handle and enable checkpoints`
- `475ee13` - `Move product reads off warp core`

## What We Set Out To Prove

This slice existed to prove:

- `think` could stop rebuilding graph traversal logic in app code
- browse bootstrap could become materially faster on a real archive
- the `git-warp v15` application read model was viable for product surfaces, not just for substrate demos

## What Shipped

Implementation:

- [src/store.js](/Users/james/git/think/src/store.js)
- [src/cli.js](/Users/james/git/think/src/cli.js)
- [src/browse-benchmark.js](/Users/james/git/think/src/browse-benchmark.js)

Benchmark artifacts:

- [docs/benchmarks/browse-bootstrap-before.json](/Users/james/git/think/docs/benchmarks/browse-bootstrap-before.json)
- [docs/benchmarks/browse-bootstrap-after.json](/Users/james/git/think/docs/benchmarks/browse-bootstrap-after.json)

Supporting design work:

- [docs/design/archive/0020-browse-bootstrap-benchmark.md](/Users/james/git/think/docs/design/archive/0020-browse-bootstrap-benchmark.md)
- [docs/design/0022-graph-native-browse-read-refactor.md](/Users/james/git/think/docs/design/0022-graph-native-browse-read-refactor.md)

## Human Stakeholder Playback

Human playback verdict:

- pass

Observed outcome:

- browse startup on the real archive improved from roughly `8s` to roughly `2s`
- final human playback judgment was that browsing now feels instant

## Agent Stakeholder Playback

Agent playback verdict:

- pass

Why:

- product reads no longer route traversal/query through `core()`
- the browse shell and JSON surfaces stayed coherent through the refactor
- the substrate is now doing the graph work it should have been doing all along

## Design-Conformance Check

Did implementation deviate from the approved design?

- no material drift remains

What matched:

- browse bootstrap moved onto graph-native anchors
- product reads moved onto the intended `git-warp v15` read-handle model
- the benchmark comparison was captured explicitly rather than inferred from feel alone

One narrow caveat remains:

- targeted content attachment reads still use `core().getContent(...)`

That is acceptable because the current `v15` `Worldline` / `Observer` API does not expose content blobs directly. The app is no longer using `core()` for traversal, query, or whole-state product reads.

## Benchmark Outcome

Committed comparison:

- `BEFORE` median: `4152.16075 ms`
- `AFTER` median: `345.786625 ms`

This is the first benchmark result in this thread that matches the human playback direction instead of contradicting it.

## What We Learned

- the biggest performance wins were not cosmetic TUI changes
- the real levers were:
  - checkpointing
  - handle reuse
  - stopping product reads from treating `core()` inspection APIs as the normal app read model
- the human playback was essential because the earlier synthetic improvement did not yet map to real archive feel

## Recommendation

Close this slice and treat the graph-native browse/read refactor as delivered.

Future performance work should now focus on narrower follow-through items, not on revisiting the old “rebuild the graph in app code” mistake.
