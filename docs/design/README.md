# Design Review Package

Status: design approved; `M0`, `M1`, `M2`, and `M3` complete; `M4` implementation in progress; agent-native CLI, graph derivation, ingress pipeline, pressure-test/spitball split, and `M4` read-mode, Bijou read-shell, first-derived-artifact, derivation-catalog, session-context-browse, session-traversal, remember, remember-enhancements, graph-versioning/migration, browse-bootstrap-benchmark, graph-migration-gating, graph-native-browse-read-refactor, graph-migration-progress-ux, prompt-telemetry-read-surface, and session-presentation-polish designs implemented and under active use

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
- [`0008-agent-native-cli.md`](./0008-agent-native-cli.md): IBM Design Thinking frame for treating agents as first-class CLI consumers through a versioned JSONL plumbing contract.
- [`0009-graph-derivation-model.md`](./0009-graph-derivation-model.md): technical graph model for raw capture, content identity, derived artifacts, sessions, and later mode outputs.
- [`0010-ingress-and-derivation-pipeline.md`](./0010-ingress-and-derivation-pipeline.md): technical note for when derivation runs, which process owns it, and why Git hooks are not the correctness path.
- [`0011-pressure-test-and-spitball.md`](./0011-pressure-test-and-spitball.md): product note separating deterministic pressure-testing from future explicit LLM-assisted spitballing.
- [`0012-m4-reentry-browse-inspect.md`](./0012-m4-reentry-browse-inspect.md): product note defining the next human read surfaces as `recent`, `browse`, and `inspect`.
- [`0013-m4-bijou-read-shell.md`](./0013-m4-bijou-read-shell.md): IBM Design Thinking style product note for adopting a Bijou TUI as the first explicit human browse/inspect shell for M4.
- [`0014-m4-first-derived-artifacts.md`](./0014-m4-first-derived-artifacts.md): IBM Design Thinking style product/technical note for the first real derivation bundle that makes `inspect` materially useful during M4.
- [`0015-per-thought-derivation-catalog.md`](./0015-per-thought-derivation-catalog.md): consolidated catalog of what is derived from each raw thought, when it is derived, what its payload looks like, and what is currently implemented versus deferred.
- [`0016-m4-session-context-browse.md`](./0016-m4-session-context-browse.md): IBM Design Thinking style product note for the implemented session-context browse slice, using `session_attribution` to recover local context without drifting into graph theater.
- [`0017-m4-session-traversal.md`](./0017-m4-session-traversal.md): IBM Design Thinking style product note for adding explicit same-session traversal to `browse` without collapsing chronology and session into one navigation model.
- [`0018-m4-remember.md`](./0018-m4-remember.md): IBM Design Thinking style product note for adding context-scoped recall through `think --remember`, with both ambient project recall and explicit query recall.
- [`0019-graph-versioning-and-migration.md`](./0019-graph-versioning-and-migration.md): technical correction note for versioning the graph model and migrating from the current property-linked repos to explicit graph-native relationships.
- [`0020-browse-bootstrap-benchmark.md`](./0020-browse-bootstrap-benchmark.md): technical note for the reproducible synthetic browse benchmark fixture and the committed before/after bootstrap baselines.
- [`0021-graph-migration-gating.md`](./0021-graph-migration-gating.md): technical/product note for when graph migration is required, when it may run automatically, and why capture remains exempt from blocking upgrades.
- [`0022-graph-native-browse-read-refactor.md`](./0022-graph-native-browse-read-refactor.md): technical/product note for making browse and inspect use graph-native read paths, explicit traversal edges, and the committed browse bootstrap benchmark. This refactor is implemented and closed.
- [`0023-remember-enhancements.md`](./0023-remember-enhancements.md): implemented enhancement slice for `--remember` — `--limit`, `--brief`, and bounded recall triage, with later ideas still explicitly deferred.
- [`0024-graph-migration-progress-ux.md`](./0024-graph-migration-progress-ux.md): product note for making the human interactive migration path visibly in progress after the user chooses `Upgrade now`, while keeping agent and non-interactive flows explicit failures.
- [`0025-prompt-telemetry-read-surface.md`](./0025-prompt-telemetry-read-surface.md): implemented telemetry read slice for a factual CLI / JSON surface over the macOS prompt telemetry, kept separate from `--stats` and explicitly out of dashboard territory.
- [`0026-m4-session-presentation-polish.md`](./0026-m4-session-presentation-polish.md): implemented browse-polish slice for clearer session presentation, calmer metadata, and short visible ids without changing browse semantics.
- [`ROADMAP.md`](./ROADMAP.md): milestone sequence, hill mapping, exit criteria, and review checkpoints.
- [`../retrospectives/m1-capture-core-and-upstream-backup.md`](../retrospectives/m1-capture-core-and-upstream-backup.md): closeout for the first implemented milestone and the remaining validation follow-through.
- [`../retrospectives/m2-macos-capture-surface.md`](../retrospectives/m2-macos-capture-surface.md): closeout for the native menu bar app and hotkey capture surface.
- [`../retrospectives/m3-reflect-mode.md`](../retrospectives/m3-reflect-mode.md): closeout for the first explicit post-capture reflect mode and the pressure-test/spitball split it uncovered.
- [`../retrospectives/m4-session-context-browse.md`](../retrospectives/m4-session-context-browse.md): closeout for the first M4 slice that makes browse consume `session_attribution` honestly in both the TUI and JSON surfaces.
- [`../retrospectives/m4-session-traversal.md`](../retrospectives/m4-session-traversal.md): closeout for the M4 slice that makes same-session movement a first-class browse behavior for both humans and agents.
- [`../retrospectives/m4-graph-migration-gating.md`](../retrospectives/m4-graph-migration-gating.md): closeout for the slice that makes migration explicit for graph-native commands while keeping raw capture migration-safe.
- [`../retrospectives/m4-v3-read-edge-substrate.md`](../retrospectives/m4-v3-read-edge-substrate.md): closeout for the narrower sub-slice that lands `v3` graph-native read edges without yet claiming the browse bootstrap performance win.
- [`../retrospectives/m4-graph-native-browse-read-refactor.md`](../retrospectives/m4-graph-native-browse-read-refactor.md): closeout for the slice that moves product reads onto `WarpApp -> worldline() -> observer(...)`, enables checkpoint-backed browse startup, and records the official `AFTER` benchmark.
- [`../retrospectives/m4-graph-migration-progress-ux.md`](../retrospectives/m4-graph-migration-progress-ux.md): closeout for the slice that makes the human interactive upgrade moment visibly in progress while keeping agent and capture behavior unchanged.
- [`../retrospectives/m4-remember-enhancements.md`](../retrospectives/m4-remember-enhancements.md): closeout for the slice that adds bounded and brief remember recall without changing the underlying ranking model.
- [`../retrospectives/m4-prompt-telemetry-read-surface.md`](../retrospectives/m4-prompt-telemetry-read-surface.md): closeout for the slice that turns recorded prompt telemetry into a factual CLI / JSON read surface without drifting into dashboards.
- [`../retrospectives/m4-session-presentation-polish.md`](../retrospectives/m4-session-presentation-polish.md): closeout for the slice that makes browse session context calmer and more structured without changing session semantics.
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
    R --> A8["0008 Agent-Native CLI"]
    R --> G9["0009 Graph Derivation Model"]
    R --> P10["0010 Ingress And Derivation Pipeline"]
    R --> P11["0011 Pressure-Test And Spitball"]
    R --> P12["0012 M4 Reentry, Browse, And Inspect"]
    R --> P13["0013 M4 Bijou Read Shell"]
    R --> P14["0014 M4 First Derived Artifacts"]
    R --> P15["0015 Per-Thought Derivation Catalog"]
    R --> P16["0016 M4 Session-Context Browse"]
    R --> P17["0017 M4 Session Traversal"]
    R --> P18["0018 M4 Remember"]
    R --> P19["0019 Graph Versioning And Migration"]
    R --> P20["0020 Browse Bootstrap Benchmark"]
    R --> P21["0021 Graph Migration Gating"]
    R --> P22["0022 Graph-Native Browse Read Refactor"]
    R --> P23["0023 Remember Enhancements"]
    R --> P24["0024 Graph Migration Progress UX"]
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
    A --> A8
    A --> G9
    A --> P10
    M --> P11
    M --> P12
    M --> P13
    M --> P14
    M --> P15
    M --> P16
    M --> P17
    M --> P18
    A --> P19
    A --> P20
    G9 --> P19
    P10 --> P19
    P15 --> P19
    P19 --> P20
    P19 --> P21
    P20 --> P21
    P19 --> P22
    P20 --> P22
    P21 --> P22
    P21 --> P24
    B3 --> G9
    B3 --> P11
    P11 --> P12
    P12 --> P13
    P12 --> P14
    P14 --> P15
    P15 --> P16
    G9 --> P10
    G9 --> P14
    G9 --> P15
    P10 --> P14
    P10 --> P15
    P14 --> P16
    P16 --> P17
    P12 --> P18
    P15 --> P18
    P17 --> P18
    P18 --> P19
    P21 --> RD
    P20 --> RD
    T --> A8
    T --> P10
    M2 --> RD
    B3 --> RD
    A8 --> RD
    G9 --> RD
    P10 --> RD
    P11 --> RD
    P12 --> RD
    P13 --> RD
    P14 --> RD
    P15 --> RD
    P16 --> RD
    P17 --> RD
    P18 --> RD
    P19 --> RD
    P20 --> RD
    P21 --> RD
    P18 --> P23
    P22 --> RD
    P23 --> RD
    P24 --> RD
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

That review is now complete. Production implementation began after approval, Milestones 1 through 3 have been closed, and Milestone 4 is now underway in implementation.
