# Design Review Package

Status: design approved; `M0`, `M1`, and `M2` complete; `M3` tests as spec in progress

This directory began as the pre-implementation design package for `think`.

The intent was to lock the product shape, architectural boundaries, and milestone sequence before writing production code. The package is intentionally small. It should be possible to review the entire set in one sitting and come out with a clear go/no-go decision.

## Review Scope

This review is meant to answer five questions:

1. Is the product thesis still sharp and defensible?
2. Are the v0 hills concrete enough to guide decisions?
3. Is the architecture honest to the thesis?
4. Are the milestones sequenced around user value rather than technical vanity?
5. Does the testing strategy keep us deterministic and local-first?

## Artifacts

- [`0001-product-frame.md`](./0001-product-frame.md): sponsor user, jobs, hills, experience principles, risks, and playback framing.
- [`0002-v0-architecture.md`](./0002-v0-architecture.md): system shape, writer model, storage/replication model, and read/sync policy.
- [`0003-spec-and-test-strategy.md`](./0003-spec-and-test-strategy.md): design for tests-as-spec, deterministic harnesses, and repo isolation.
- [`0004-modes-and-success-metrics.md`](./0004-modes-and-success-metrics.md): capture/brainstorm/reflection/x-ray mode doctrine and usage metrics for validating product fit.
- [`0005-m2-macos-capture-surface.md`](./0005-m2-macos-capture-surface.md): IBM Design Thinking frame and interaction doctrine for the menu bar app and transient capture panel.
- [`0006-stats-command.md`](./0006-stats-command.md): read-only stats surface for habit validation without dashboard drift.
- [`0007-m3-brainstorm-mode.md`](./0007-m3-brainstorm-mode.md): IBM Design Thinking frame for explicit, deterministic brainstorm sessions.
- [`ROADMAP.md`](./ROADMAP.md): milestone sequence, hill mapping, exit criteria, and review checkpoints.
- [`../retrospectives/m1-capture-core-and-upstream-backup.md`](../retrospectives/m1-capture-core-and-upstream-backup.md): closeout for the first implemented milestone and the remaining validation follow-through.
- [`../retrospectives/m2-macos-capture-surface.md`](../retrospectives/m2-macos-capture-surface.md): closeout for the native menu bar app and hotkey capture surface.
- [`BACKLOG.md`](../../BACKLOG.md): deferred ideas, cool ideas, and parking-lot items that should not silently become approved scope.

## Review Package Map

```mermaid
flowchart TD
    R["Design Review Package"] --> P["0001 Product Frame"]
    R --> A["0002 V0 Architecture"]
    R --> T["0003 Spec and Test Strategy"]
    R --> M["0004 Modes and Success Metrics"]
    R --> M2["0005 M2 macOS Capture Surface"]
    R --> S["0006 Stats Command"]
    R --> B3["0007 M3 Brainstorm Mode"]
    R --> RD["Roadmap and Milestones"]
    R --> BL["Backlog (deferred ideas)"]
    P --> A
    P --> M
    A --> T
    P --> RD
    M --> RD
    M --> M2
    M --> S
    M --> B3
    M2 --> RD
    B3 --> RD
```

## Review Standard

Approve these docs only if they preserve the core doctrine:

- raw capture is sacred
- capture must be cheap
- interpretation is deferred
- provenance matters
- replay matters
- Git/WARP complexity stays below the user experience

If a design choice improves technical sophistication but adds friction to capture, it should be rejected.

## Out Of Scope For This Review

- final UI mockups
- implementation details at module/class/function level
- packaging/distribution details
- auth and hosted deployment strategy
- production sync topology beyond the first upstream backup target

## Expected Outcome

After review, we should either:

- approve the package and start writing spec tests, or
- return with specific changes to hills, architecture boundaries, or milestone sequencing

That review is now complete. Production implementation began after approval, and Milestones 1 and 2 have now been closed.
