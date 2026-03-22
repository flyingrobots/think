# Contributing To `think`

`think` is not a generic note-taking app. It is a local-first system for cheap, exact, replayable thought capture.

If you contribute here, the job is not just to write code that works. The job is to protect the product doctrine while making the implementation more capable.

## Core Product Philosophy

- Raw capture is sacred.
- Capture must be cheap.
- Capture first. Interpret later.
- Never mix capture and interpretation in the same user moment.
- Provenance matters.
- Replay matters.
- The substrate may be sophisticated; the capture experience cannot feel sophisticated.

The highest-level rule is simple:

If a change makes capture slower, smarter, noisier, or more demanding, it is probably the wrong change.

## Development Philosophy

This project prefers:

- DX over ceremony
- behavior over architecture theater
- explicit boundaries over clever coupling
- local-first operation over network dependency
- boring user-facing flows over impressive internals

In practice, that means:

- keep commands small and obvious
- keep default UX boring and legible
- keep product language free of Git/WARP jargon
- keep future intelligence out of the capture path until it is earned

## Architectural Principles

### Hexagonal architecture

The product should have clear boundaries between:

- domain behavior
- application/use-case orchestration
- ingress adapters such as CLI or macOS UI
- infrastructure such as Git/WARP persistence and replication

Do not let UI concerns leak into persistence.
Do not let storage details leak into normal UX.

### SOLID, pragmatically applied

Use SOLID as a boundary discipline, not as a reason to create needless classes or abstractions.

Good:

- narrow modules
- explicit seams
- dependency inversion around important adapters

Bad:

- abstraction for its own sake
- indirection before there is pressure for it
- “clean architecture” rituals that slow down delivery without protecting behavior

## Product Management Philosophy

This project uses IBM Design Thinking style framing for milestone design:

- sponsor user
- hills
- playback questions
- explicit non-goals

Milestones should be grounded in user value, not in backend vanity.

Before promoting a new direction, ask:

- which hill does this support?
- what user behavior or trust does this improve?
- does this preserve cheap capture?

If the answer is unclear, the work probably belongs in the backlog, not the roadmap.

## Build Order

The expected order of work is:

1. Write or revise design docs first.
2. Encode behavior as executable tests second.
3. Implement third.

Tests are the spec.

Do not insert a second prose-spec layer between design and tests.
Do not treat implementation details as the primary unit of correctness.

## Milestone Development Loop

Each milestone should follow the same explicit loop:

1. design docs first
2. tests as spec second
3. implementation third
4. retrospective after delivery
5. rewrite the root README to reflect reality
6. close the milestone in roadmap/status docs

This loop is part of the process, not optional cleanup.

The point is to keep the repo honest about:

- what is planned
- what is specified
- what is actually implemented
- what was learned

## Release Discipline

Milestone closure and release discipline are coupled.

Rules:

- keep a root [CHANGELOG.md](/Users/james/git/think/CHANGELOG.md)
- start versioning at `0.1.0`
- when a milestone is closed, bump `package.json` on the release commit
- create a Git tag on the commit that lands on `main` for that milestone release

Examples:

- `v0.1.0`
- `v0.2.0`

The version/tag should reflect milestone reality, not aspirational scope.

## Testing Rules

Tests must be deterministic.

That means:

- no real network dependency
- no real home-directory state
- no ambient Git config assumptions
- no interactive shell expectations
- no timing-based flakes
- no global hotkey dependence in the core suite

Every test that touches storage should use isolated temp state.

Prefer:

- temp app homes
- throwaway local repos
- throwaway bare remotes
- fixed env and fixed IDs where practical

Tests should pin:

- user-visible behavior
- exact raw preservation
- immutability boundaries
- honest backup semantics
- mode separation

They should not overfit:

- class layout
- file-private helpers
- incidental implementation structure

## Capture-Path Guardrails

Do not introduce any of the following into the plain capture path unless explicitly re-approved:

- embeddings
- clustering
- concept matching
- retrieval-before-write
- suggestions during capture
- tags or ontology prompts
- dashboard behavior

The capture path should feel closer to a trapdoor than a workflow.

## Read-Path Guardrails

`recent` must stay boring.

That means:

- plain
- chronological
- not “smart”
- not summary-driven
- not cluster-driven

Reflection, brainstorm, and x-ray can become richer later. `recent` should not quietly absorb their responsibilities.

## UX Language Rules

Default user-facing language should avoid substrate terms.

Prefer:

- `Saved locally`
- `Backed up`
- `Backup pending`

Avoid exposing:

- commit
- push
- pull
- ref
- repo
- graph internals

If the system is doing something sophisticated under the hood, the default UX should still read as simple and trustworthy.

## Git Workflow

Prefer small, honest commits.

Do not rewrite shared history casually.
Prefer additive commits over history surgery.
Prefer merges over rebases for shared collaboration unless there is a compelling, explicitly discussed reason otherwise.

The point is not aesthetic Git history. The point is trustworthy collaboration.

## What To Read First

Before making non-trivial changes, read:

- [README.md](/Users/james/git/think/README.md)
- [docs/design/README.md](/Users/james/git/think/docs/design/README.md)
- [docs/design/0005-m2-macos-capture-surface.md](/Users/james/git/think/docs/design/0005-m2-macos-capture-surface.md)
- [docs/design/ROADMAP.md](/Users/james/git/think/docs/design/ROADMAP.md)
- [docs/retrospectives/m1-capture-core-and-upstream-backup.md](/Users/james/git/think/docs/retrospectives/m1-capture-core-and-upstream-backup.md)
- [BACKLOG.md](/Users/james/git/think/BACKLOG.md)

## Decision Rule

When in doubt:

- choose less structure
- choose lower latency
- choose fewer fields
- choose local-first
- choose behavior over architecture
- keep `recent` boring
- protect the capture moment from intelligence creep
