# Retrospective: 0008 — Prune stale bad-code backlog

## Outcome

**Hill met.**

## What shipped

- removed the stale `bad-code` backlog note for shared Swift path search, which was already closed in cycle `0007`
- removed the stale `bad-code` backlog note for `CONTRIBUTING.md`, which was already closed in cycle `0006`
- aligned `CHANGELOG.md` release-discipline wording with the current cycle-based METHOD docs
- updated `docs/BEARING.md` and `CHANGELOG.md` for the cleanup closeout

## Playback

### Agent perspective

1. Stale `bad-code` notes removed? **Yes** — the `bad-code` lane no longer contains the already-shipped CONTRIBUTING refresh and shared path-search work.
2. Release-discipline wording aligned? **Yes** — `CHANGELOG.md` now says cycle closeout produces the release-candidate state, matching `CONTRIBUTING.md` and `docs/method/release.md`.
3. `BEARING.md` updated honestly? **Yes** — it now records the backlog cleanup as the most recent shipped repo-maintenance slice.

### Human perspective

4. Does the lane now read like current debt? **Yes** — stale debt memory is gone instead of being left for a maintainer to second-guess.
5. Was the cleanup kept narrow? **Yes** — no new process or product behavior was introduced.

## Drift check

This stayed a docs-only cleanup slice. The only scope expansion was fixing the stale release-discipline wording in `CHANGELOG.md` because it was part of the same inconsistency cluster.

## New debt

None.

## Cool ideas

- Add a lightweight maintainer sweep at cycle close to remove backlog notes that have become obsolete because the work already landed.
- Consider a tiny docs-consistency check for obviously stale lane entries versus recently shipped cycle notes.
