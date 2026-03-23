# Roadmap And Milestones

Status: `M0`, `M1`, and `M2` complete; `M3` next

## Planning Frame

This roadmap is grounded in the hills from [`0001-product-frame.md`](./0001-product-frame.md).

Milestones exist to prove user value in sequence. They are not buckets for unrelated engineering activity.

## Current Status

- `M0: Design lock` is complete.
- `M1: Capture core and upstream backup` is complete from an implementation/specification standpoint.
- `M1` still has follow-through validation work around real-world usage and latency measurement.
- `M2: macOS capture surface` is complete.
- `M3: Brainstorm Mode` is next.

## Planning Principles

1. Capture value before reflection value.
2. Prove real usage before building ontology.
3. Keep the local-first path excellent before expanding ingress options.
4. Add infrastructure only when it serves a hill directly.

## Milestone Flow

```mermaid
flowchart LR
    M0["M0: Design lock"] --> M1["M1: Capture core and upstream backup"]
    M1 --> M2["M2: macOS capture surface"]
    M2 --> M3["M3: Brainstorm Mode"]
    M3 --> M4["M4: Reflection and X-Ray"]
    M4 --> M5["M5: Additional ingress surfaces"]
```

## Milestone 0: Design Lock

Status:

- complete

Goal:

- approve the product frame, architecture, and test strategy

Primary hill support:

- enables all hills by removing ambiguity before implementation

Deliverables:

- approved design package in `docs/design/`
- named first acceptance specs
- agreed local/upstream topology for day one

Playback questions:

- do the hills still feel sharp and product-relevant?
- does the architecture still preserve capture cheapness?
- are we testing the right promises?

Exit criteria:

- docs approved or revised with clear action items
- no unresolved contradiction about daemon/no-daemon, local/upstream, or ingress ownership

## Milestone 1: Capture Core And Upstream Backup

Status:

- complete for implementation/specification
- follow-through remains for habit validation and latency measurement

Goal:

- make raw capture work reliably from the CLI into a private local Git/WARP repo with day-one private upstream backup

Primary hill support:

- Hill 1
- Hill 2

Deliverables:

- `think "..."` direct capture
- local repo bootstrap
- upstream config and bootstrap path
- immutable raw entry storage
- best-effort push after local success
- visible backup state model: local/backed-up/pending
- deterministic acceptance specs for capture, recent, and replication using temp bare remotes
- capture latency budget and benchmark harness

Playback:

- user can capture a thought from the shell in under a second on a warm path
- exact wording is preserved
- recent entries can be listed without exposing Git concepts
- local save still succeeds while offline
- backup succeeds when upstream is reachable
- backup state is honest and understandable
- daily capture usage begins to approach habit-forming levels

Exit criteria:

- all core capture specs pass
- no required daemon
- local success never depends on network
- replication tests are deterministic
- no Git terminology leaks into the normal user flow
- capture is habit-friendly enough that the user reaches for it without prompting
- no embeddings or clustering work begins before capture habit is proven

## Milestone 2: macOS Capture Surface

Status:

- complete

Goal:

- make the capture experience genuinely habit-forming on macOS

Primary hill support:

- Hill 1
- Hill 2

Deliverables:

- menu bar app
- global hotkey
- Spotlight-like transient capture panel
- same shared capture core used by the CLI

Playback:

- user can hit the hotkey, type, press Enter, and dismiss in one motion
- capture feels faster than opening a notes app
- backup state is either silent or minimally visible, never distracting

Exit criteria:

- capture panel is the preferred daily capture path on Mac
- menu bar app remains thin and does not become an ad hoc admin console

## Milestone 3: Brainstorm Mode

Goal:

- add an explicit session-based mode that helps the user expand and pressure-test an idea without corrupting raw capture

Primary hill support:

- Hill 3

Deliverables:

- `think brainstorm ...` or equivalent seeded mode
- question-led interaction instead of generic idea spam
- brainstorm outputs stored separately from raw capture entries

Playback:

- the mode helps the user sharpen or reframe an idea
- the mode feels like a thinking partner rather than autocomplete
- raw capture remains the default and is not interrupted by brainstorming behavior

Exit criteria:

- brainstorm mode produces new useful entries
- brainstorm is entered deliberately and never ambushes plain capture

## Milestone 4: Reflection And X-Ray

Goal:

- add richer read modes that revisit captures without violating raw-entry immutability

Primary hill support:

- Hill 3

Deliverables:

- richer `recent` or reentry flow
- first reflective dialogue prototype
- first explicit x-ray mode prototype
- sync-first read posture where useful
- scoped materialization policy for deeper modes

Playback:

- user can return to old captures and see them in context
- dialogue mode helps the user earn insight rather than spoon-feeding it
- x-ray mode provides receipts when the user wants to inspect structure directly
- derived structure remains clearly separate from raw capture

Exit criteria:

- no mutation of raw entries
- reflective modes improve understanding without adding capture friction

## Milestone 5: Additional Ingress Surfaces

Goal:

- add remote and ambient capture options without centralizing the system around a daemon

Primary hill support:

- Hill 1
- Hill 2

Candidates:

- web capture URL
- email ingress
- text-to-think

Playback:

- user can capture from outside their Mac without learning a new mental model
- provenance remains honest per ingress surface

Exit criteria:

- each new ingress uses the same core capture contract
- local and remote writers remain conceptually unified to the user

## Deferred Infrastructure

These are explicitly not first milestones:

- public hosted service
- auth system
- ontology engine
- embeddings before capture habit is proven
- clustering before capture habit is proven
- daemon-centric local architecture
- dashboard-first UX

## Review Checkpoints

Roadmap reviews should happen:

- after Milestone 0 approval
- before starting Milestone 2
- before starting Milestone 4

Those are the likely points where product direction could drift from the original thesis and should be challenged directly.
