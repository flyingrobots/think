# M4 Retrospective: V3 Read-Edge Substrate

Date: 2026-03-27
Status: complete for this sub-slice

## Slice Summary

This sub-slice advanced the graph model to `v3` and landed the read-critical edges that browse and inspect need before the hot-path refactor can become real.

Delivered behavior:

- the repo graph model is now `v3`
- new captures now maintain:
  - `meta:graph --latest_capture--> capture`
  - `capture(newer) --older--> capture(older)`
- new reflect writes now maintain:
  - `reflect_session --seeded_by--> capture`
  - `reflect_entry --produced_in--> reflect_session`
  - `reflect_entry --responds_to--> capture`
- `think --migrate-graph` now backfills those edges additively
- `inspect` now prefers graph-native direct reflect receipts instead of relying only on legacy `seedEntryId` scanning
- the acceptance suite is green for the implemented behavior

## What We Set Out To Prove

This sub-slice existed to prove:

- the read-critical browse and inspect relationships can live explicitly in the graph
- migration to `v3` can stay additive and safe for mixed-generation repos
- inspect can start trusting graph-native edges before the browse bootstrap hot path is fully rewritten

## What Shipped

Implementation:

- graph model and read-edge updates in [src/store.js](../../src/store.js)

Specification:

- migration and graph-native inspect coverage in [test/acceptance/graph-migration.test.js](../../test/acceptance/graph-migration.test.js)

Supporting design work:

- [docs/design/0022-graph-native-browse-read-refactor.md](../design/0022-graph-native-browse-read-refactor.md)
- [docs/design/0019-graph-versioning-and-migration.md](../design/0019-graph-versioning-and-migration.md)
- [docs/design/0021-graph-migration-gating.md](../design/0021-graph-migration-gating.md)

Implementation commit:

- `445ac31` - `Add graph-native read edges for v3`

## Human Stakeholder Playback

Human playback verdict:

- pass

What the human stakeholder reported:

- browse still looks good
- no obvious regression surfaced in browse or inspect

This slice was intentionally low-drama at the UI layer, and the right outcome was “invisible in the good way.”

## Agent Stakeholder Playback

Agent playback verdict:

- pass

Why:

- the graph model is now coherently `v3`
- migration can backfill the new read-critical edges additively
- direct reflect receipts no longer depend only on legacy linkage properties
- mixed-generation repos remain readable while preferring the graph-native path

## Design-Conformance Check

Did implementation deviate from the approved design?

- yes, partially

What matched:

- `v3` graph versioning landed
- the read-critical edge set for chronology and reflect receipts landed
- migration remained additive
- inspect began preferring graph-native receipts

What did not land yet:

- the live browse bootstrap hot-path refactor
- a meaningful startup-latency improvement that earns the official `AFTER` benchmark capture

Design correction:

- the implementation is being closed as a narrower sub-slice: `v3` read-edge substrate
- [docs/design/0022-graph-native-browse-read-refactor.md](../design/0022-graph-native-browse-read-refactor.md) remains in progress rather than being marked fully implemented

## What We Learned

- the graph substrate and the hot-path performance win are separable pieces of work
- it was still worth landing the `v3` read edges first because they make the next browse refactor simpler and more honest
- the design-drift check matters: without it, we would have been tempted to claim the whole refactor was done when only the substrate was

## Recommendation

Close this sub-slice, not the whole `0022` note.

The next slice should:

- move bare `--browse` startup onto the `latest_capture` and `older` edges
- avoid whole-archive scans before first paint
- then capture the official `AFTER` benchmark against [docs/benchmarks/browse-bootstrap-before.json](../benchmarks/browse-bootstrap-before.json)
