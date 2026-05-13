---
title: "Repair local minds after git-warp v17"
legend: "CORE"
cycle: "0066-repair-v17-git-warp-minds"
source_backlog: "docs/method/backlog/asap/CORE_repair-v17-git-warp-minds.md"
---

# Repair local minds after git-warp v17

Source backlog item: `docs/method/backlog/asap/CORE_repair-v17-git-warp-minds.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Codex

## Hill

A local Think mind with an old git-warp checkpoint can be repaired by one
explicit command or script without rewriting graph history. The repair backs up
the old checkpoint ref, runs the git-warp schema upgrade, preserves legacy blob
content anchors, writes a fresh checkpoint, and leaves the mind readable.

## Playback Questions

### Human

- [ ] Can I repair a named local mind, then run `<mind>-think --remember --json`
      without the schema:4 checkpoint error?
- [ ] Can I see the dated pre-upgrade checkpoint backup ref if I need to audit
      or recover the repair?

### Agent

- [ ] Does the repair flow resolve `--mind <name>` to `~/.think/<name>` and use
      graph `think` by default?
- [ ] Does a dry-run report the mind needs upgrade before repair and already
      current after repair?
- [ ] Does the flow create
      `refs/warp/think/checkpoints/pre-v17-upgrade-<timestamp>` before changing
      the live checkpoint ref?
- [ ] Does the flow preserve legacy `_content_<oid>` anchors as `100644 blob`
      entries when the referenced object is a raw Git blob?
- [ ] Does the flow write a fresh checkpoint after the upgrade?
- [ ] Does `git warp check` report `patchesSinceCheckpoint: 0` after repair?
- [ ] Does `git warp doctor` report zero failures, except explicitly documented
      warnings?
- [ ] Does regression coverage include an old checkpoint whose `_content_<oid>`
      anchor points at a blob?
- [ ] Does normal capture, remember, browse, and inspect code stay free of
      v17-specific compatibility branches?

## All postures

Not applicable. This is local repair tooling for already-broken local minds.

## Non-goals

- Not moving Think onto Echo in this cycle.
- Not changing normal capture, remember, browse, inspect, or MCP read behavior.
- Not rewriting WARP graph history.
- Not making automatic repair happen during ordinary reads.
- Not repairing arbitrary non-Think git-warp repos.
- Not solving hosted sharing, remote relay, or multi-mind-in-one-repo identity.

## Selected Path

Start with a repo-owned script, `scripts/repair-v17-mind.mjs`, rather than a
new public CLI command. The backlog calls for "one command or scripted flow",
and a script keeps the compatibility path explicit while avoiding permanent
git-warp-version logic in the normal runtime.

If the script proves stable, a later cycle can add a thin `think doctor --repair
--mind <name>` wrapper around the same implementation.

## Design

### Inputs

The first repair surface should accept:

```bash
node scripts/repair-v17-mind.mjs --mind claude
node scripts/repair-v17-mind.mjs --repo ~/.think/claude --graph think
node scripts/repair-v17-mind.mjs --mind claude --dry-run --json
```

Rules:

- `--mind <name>` resolves to `~/.think/<name>`.
- `--repo <path>` is allowed for fixtures and explicit local repair.
- `--graph` defaults to `think`.
- `--json` emits machine-readable stage results.
- `--dry-run` never changes refs or checkpoints.
- The command refuses to run without a Git repo at the target path.

### Repair Stages

1. Inspect the target checkpoint ref:
   `refs/warp/<graph>/checkpoints/head`.
2. Run the git-warp schema upgrade dry-run for the target repo and graph.
3. If repair is needed, create a dated backup ref:
   `refs/warp/<graph>/checkpoints/pre-v17-upgrade-<YYYYMMDD-HHMMSS>`.
4. Run the git-warp schema upgrade for real.
5. Attempt a fresh checkpoint/materialization pass.
6. If checkpoint creation rejects a legacy `_content_<oid>` anchor because the
   object is a raw blob, rebuild the checkpoint tree with that entry as
   `100644 blob` rather than `040000 tree`.
7. Verify the repaired repo with upgrade dry-run, `git warp check`, and
   `git warp doctor`.

### Blob Anchor Rule

Legacy Think minds may store capture content as raw Git blobs with synthetic
anchors named `_content_<oid>`. During checkpoint repair those anchors must
remain blob entries:

```text
100644 blob <oid>    _content_<oid>
```

The repair must not assume every object reachable from a checkpoint tree is
itself a tree. If a candidate anchor names an object whose Git type is `blob`,
the repaired checkpoint tree entry must stay a blob entry. Treating it as
`040000 tree` makes Git reject the checkpoint tree and leaves the mind broken.

### Backup Ref Invariant

The live checkpoint ref may advance only after the pre-upgrade ref exists.

The repair should fail closed if it cannot create the backup ref. A failed
backup means no schema upgrade and no checkpoint mutation.

### Verification Surface

The JSON result should expose enough detail for agents and retrospectives:

```json
{
  "ok": true,
  "repo": "/Users/james/.think/claude",
  "graph": "think",
  "backupRef": "refs/warp/think/checkpoints/pre-v17-upgrade-20260512-162500",
  "beforeCheckpoint": "fe47a53d...",
  "afterCheckpoint": "7b05c...",
  "upgrade": {
    "before": "needed",
    "after": "already-current"
  },
  "check": {
    "patchesSinceCheckpoint": 0
  },
  "doctor": {
    "failures": 0,
    "warnings": []
  }
}
```

## Files To Modify

- `scripts/repair-v17-mind.mjs` — explicit local repair script
- `test/acceptance/repair-v17-mind.test.js` — fixture-backed repair coverage
- `package.json` — optional npm alias if useful after the script is stable

## Test Strategy

Use a fixture repo generated inside the test temp directory. The fixture should
model the old checkpoint shape narrowly enough to exercise the Think-specific
repair invariant:

- a schema:4-style checkpoint ref
- at least one legacy `_content_<oid>` anchor
- the anchor target is a Git `blob`
- repair creates a backup checkpoint ref
- repair writes a fresh checkpoint ref
- post-repair dry-run reports already-current

Where practical, the test should execute the same script entry point an agent
would run. If git-warp v17 CLI behavior is not available in CI, split the core
ref/tree repair logic behind a small module and cover that module directly,
while keeping one integration smoke test for environments that have the v17
toolchain.

## Backlog Context

The motivating failure was a local mind upgraded across git-warp v17 where
remember failed with:

```text
Checkpoint <sha> is schema:4. Only schema:5 checkpoints are supported.
```

A controlled repair on `~/.think/claude` backed up the checkpoint at
`refs/warp/think/checkpoints/pre-v17-upgrade-20260505-102848`, wrote repaired
checkpoint `91f65c...`, later advanced to `7b05c...`, and finished with doctor
reporting zero failures.

This cycle turns that manual recovery into repeatable Think-owned tooling.
