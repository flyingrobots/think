# Retrospective: 0006 — Refresh CONTRIBUTING for METHOD

## Outcome

**Hill met.**

## What shipped

- `CONTRIBUTING.md` rewritten to match the current METHOD workflow and repo references
- stale IBM Design Thinking framing removed from the contributor guide
- old milestone-development-loop guidance replaced with the current cycle loop
- current backlog, design, retro, release, and verification references made explicit
- `docs/BEARING.md` and `CHANGELOG.md` updated for cycle closeout

## Playback

### Agent perspective

1. Current backlog/design/retro locations? **Yes** — `CONTRIBUTING.md` now points at `docs/method/backlog/`, `docs/design/<cycle>/`, and `docs/method/retro/<cycle>/`.
2. METHOD cycle loop instead of the retired milestone loop? **Yes** — the guide now states `pull -> design -> RED -> GREEN -> playback -> retro -> close`.
3. IBM framing removed but current design-note expectations preserved? **Yes** — the branding is gone, but the guide still asks for sponsors, hill, playback questions, scope, and non-goals in cycle design notes.
4. Verification and release guidance aligned with repo truth? **Yes** — commands and release rules now match `CLAUDE.md`, `docs/method/process.md`, and `docs/method/release.md`.

### Human perspective

1. Can a new contributor understand the current workflow from one doc? **Yes** — the guide now starts with the product doctrine, first reads, current workflow, and verification commands.
2. Is the capture doctrine still obvious? **Yes** — the capture-path guardrails remain explicit and prominent.

## Drift check

This was a docs-only cycle, so there was no RED/GREEN code path. The delivery matched the design note: refresh the contributor guide and close the slice with bearing/changelog updates. No unintended drift.

## New debt

None.

## Cool ideas

- Add a lightweight docs smoke test that checks for obviously stale references such as deleted paths or retired process labels.
- Consider a short repo-local maintainer checklist for cycle closeout docs so `BEARING.md`, `CHANGELOG.md`, and retros stay in sync.
