# M4 Graph Migration Gating Retro

Status: closed

## Slice

- design: [0021-graph-migration-gating.md](/Users/james/git/think/docs/design/0021-graph-migration-gating.md)
- specs: [graph-migration.test.js](/Users/james/git/think/test/acceptance/graph-migration.test.js)
- implementation commits:
  - `1b8d464` - `Gate graph-native commands on graph migration`

## Hill Check

Target hill:

> If a `think` repo needs graph migration, raw capture still succeeds without friction, while graph-native commands either guide the human through an explicit upgrade or fail clearly for non-interactive/agent callers.

Result:

- pass

The delivered behavior now preserves raw capture first, blocks graph-native commands on outdated repos, and makes the upgrade boundary explicit instead of permissive or magical.

## Playback

### Human Stakeholder Playback

Outcome:

- pass

Observed:

- the interactive cancel path behaved clearly
- graph-native use on an outdated repo felt understandably gated
- capture-first doctrine still felt right

Human follow-up feedback:

- the upgrade UX would feel better with an explicit visible progress treatment during migration, such as:
  - `Upgrading`
  - a progress bar or similar motion cue

That is follow-through, not a blocker for the slice.

### Agent Stakeholder Playback

Outcome:

- pass

Observed:

- capture no longer depends on pre-save migration
- `--json` now exposes explicit `graph.migration_required`
- graph-native gating is narrow and inspectable instead of hidden
- the command boundary remains honest for agents

## Design-Conformance Check

Did implementation deviate from the approved design?

- no material drift

What matched:

- capture is exempt from blocking migration
- migration may run after raw local save
- graph-native commands can require `v2`
- interactive human flows can upgrade or cancel
- agent/non-interactive flows fail explicitly

What remains incomplete but already acknowledged by design:

- richer upgrade progress UX
- stronger migration concurrency/locking details

## What We Learned

- the product boundary is better when migration is explicit for graph-native use but invisible to the sacred capture moment
- `v1` compatibility can stay transitional without becoming permanent doctrine
- explicit machine-readable migration errors are worth treating as product behavior, not implementation noise

## Follow-Through

- backlog the interactive migration progress affordance
- keep the next graph-native browse/read refactor separate from this policy slice
