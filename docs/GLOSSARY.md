# `think` Glossary

Status: current reference

This glossary defines the product and substrate terms that show up repeatedly in the repo.

## Core Product Terms

### capture

A raw thought written into the local repo.

Capture is the primary job of `think`. It must be cheap, exact, and local-first.

### raw capture

The exact user-entered wording at the moment of capture, before later interpretation.

### recent

The plain chronological reentry surface.

It should stay boring and trustworthy.

### remember

The context-scoped recall surface.

`remember` answers questions like:

- what was I thinking about this project?
- what did I already think about this topic?

### browse

The deliberate reader-first archive navigation surface.

For humans, bare `--browse` opens the Bijou TUI. For machines and scripted use, `--browse=<entryId>` stays explicit and inspectable.

### inspect

The explicit machinery-facing read surface.

It reveals metadata, canonical identity, and derived receipts without summarizing the thought itself.

### reflect

The explicit pressure-test mode for one captured thought.

It is not the same thing as browse, inspect, or remember.

## Data Model Terms

### entry id

The current implementation identity for one stored capture event.

Shape:

- `entry:<sortKey-uuid>`

This identifies one occurrence, not one timeless idea.

### thought

The canonical identity for exact raw text bytes.

Shape:

- `thought:<fingerprint>`

Multiple capture events may resolve to the same canonical thought.

### session

A local contextual grouping of related captures.

Sessions help browse and inspect explain nearby context without rewriting the capture itself.

### derived artifact

Append-only derived structure produced after capture.

Current examples:

- `seed_quality`
- `session_attribution`

### seed quality

A lightweight derived judgment about whether a thought looks like a plausible `Reflect` seed.

### session attribution

A derived judgment about which session a capture appears to belong to.

## Graph / Substrate Terms

### Git/WARP repo

The private local repository that stores `think` data.

Git handles the repository substrate. `git-warp` provides the graph layer on top.

### WarpApp

The primary application handle exposed by `git-warp`.

In `think`, product read paths begin from `WarpApp`.

### worldline

The normal product read handle in `git-warp`.

`think` uses `worldline()` for normal read/query/traversal work instead of relying on full-state `core()` scans.

### observer

A narrower read aperture derived from a `worldline`.

In `think`, product reads use `WarpApp -> worldline() -> observer(...)` where that helps keep read scope honest.

### core

The whole-state inspection and admin-style `git-warp` surface.

In `think`, `core()` is reserved for:

- migration
- admin-style full-state inspection
- narrow content-attachment reads not available on `worldline` / `observer`

It should not be the default product read path.

### checkpoint

`git-warp` recovery state that makes reopening read handles much faster.

Enabling checkpoints was one of the major browse-performance fixes in M4.

### graph model version

The versioned internal graph shape used by `think`.

Current read behavior targets:

- graph model `v3`

### migration

The process of upgrading old graph state to the current graph model.

Graph-native read commands may require migration. Raw capture remains exempt and saves first.

## Operational Terms

### local-first

The rule that local success is the real success condition.

Network backup is follow-through, not the definition of success.

### upstream

An optional Git remote used for backup.

### prompt metrics

macOS prompt telemetry recorded as factual usage and latency data.

This includes things like:

- prompt opens
- abandoned-empty vs abandoned-started vs submitted
- hotkey-to-visible timing
- submit-to-hide timing
- submit-to-local-save timing

### JSON contract

The machine-readable CLI behavior exposed by `--json`.

This is a real product boundary, not incidental debug output.
