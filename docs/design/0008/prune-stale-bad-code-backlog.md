# 0008: Prune stale bad-code backlog

The `bad-code` lane should describe active debt, not work that already shipped.

## Sponsors

- **Human:** James
- **Agent:** Codex

## Hill

A maintainer reading `docs/method/backlog/bad-code/` only sees active debt. Shipped slices like the CONTRIBUTING refresh and shared Swift path search are no longer represented as open bad-code work, and the surrounding release-language docs stay internally consistent.

## Playback questions

### Agent perspective

1. Are the stale `bad-code` notes for shared path search and stale `CONTRIBUTING.md` removed?
2. Does `CHANGELOG.md` now use the same cycle-based release-discipline wording as `CONTRIBUTING.md` and `docs/method/release.md`?
3. Does `BEARING.md` explain the cleanup honestly as recently shipped repo-maintenance work?

### Human perspective

4. Does the bad-code lane now read like real current debt instead of stale project memory?
5. Does the cleanup reduce confusion without inventing new process ceremony?

## Scope

### In scope

- remove stale `bad-code` backlog notes that correspond to shipped work
- add cycle `0008` design/retro closeout notes for the cleanup
- align top-level release-discipline wording in `CHANGELOG.md`
- update `BEARING.md` and `CHANGELOG.md` for cycle closeout

### Out of scope

- adding a new backlog taxonomy
- rewriting old milestone design docs
- introducing docs automation or linting
- any product or code behavior change

## Accessibility / assistive reading posture

Backlog lanes should stay short and factual. Deleting stale debt is better than asking a reader to infer whether an item is already done.

## Localization / directionality posture

Not applicable.

## Agent inspectability / explainability posture

An agent should be able to trust that backlog lanes describe live work. This slice removes two cases where the lane contradicted shipped repo state.

## Non-goals

- claiming the backlog is "done"
- re-ranking the remaining `up-next` or `cool-ideas` lanes
- changing release policy itself
