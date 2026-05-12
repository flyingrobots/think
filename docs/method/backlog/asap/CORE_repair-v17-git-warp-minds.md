---
id: CORE_repair-v17-git-warp-minds
blocks:
  - CORE_validate-daily-capture-habit
  - SURFACE_track-reentry-friction
blocked_by: []
---

# CORE - Repair Think minds after git-warp v17

Legend: CORE

## Idea

Add a documented, repeatable repair path for local Think minds after
upgrading their backing `git-warp` dependency to v17. A broken mind
currently presents as a schema error during re-entry:

```sh
claude-think --remember --json
```

Expected failure shape:

```text
Checkpoint <sha> is schema:4. Only schema:5 checkpoints are supported.
```

The operator should not need hand-rolled Node snippets, manual Git tree
surgery, or guesswork. Think should provide a first-class repair flow that
backs up the checkpoint ref, runs the git-warp schema upgrade, preserves
legacy content anchors, writes a fresh checkpoint, and verifies the mind.

## Why

Think minds are durable local memory. A dependency upgrade must not leave
`~/.think/codex`, `~/.think/claude`, or future agent minds unable to
remember, capture, or run doctor checks.

The observed v17 break has two layers:

1. Existing minds can have an old checkpoint schema.
2. Some legacy minds store content properties as raw Git blob object IDs.
   During checkpoint creation, those legacy `_content_<oid>` anchors must
   remain `100644 blob` entries. Treating them as `040000 tree` entries
   makes Git reject the checkpoint tree.

The repair path must normalize that legacy edge case during migration or
checkpoint creation without moving version-specific compatibility sludge
into the normal Think runtime.

## Scope

Provide a pullable repair cycle for one command or scripted flow, probably
one of:

- `think repair-mind --mind <name> --after-git-warp-v17`
- `think doctor --repair --mind <name>`
- a focused script under `scripts/repair-v17-mind.mjs`

The implementation should resolve named minds to `~/.think/<mind>`, default
the graph name to `think`, and operate only by creating backup refs and
advancing checkpoint refs. It must not rewrite graph history.

## Operator Runbook

Use this as the manual truth path until the command exists.

1. Confirm the mind is broken:

   ```sh
   <mind>-think --remember --json
   ```

2. Dry-run the git-warp upgrade from a git-warp v17 checkout:

   ```sh
   npm run upgrade -- --repo ~/.think/<mind> --graph think --dry-run --json
   ```

   Expected states are `would-upgrade` for an old mind or
   `already-current` after repair.

3. Create a backup checkpoint ref before changing anything:

   ```sh
   repo="$HOME/.think/<mind>"
   stamp="$(date +%Y%m%d-%H%M%S)"
   head="$(git --git-dir "$repo/.git" rev-parse refs/warp/think/checkpoints/head)"
   git --git-dir "$repo/.git" update-ref \
     "refs/warp/think/checkpoints/pre-v17-upgrade-$stamp" \
     "$head"
   ```

4. Run the upgrade:

   ```sh
   npm run upgrade -- --repo ~/.think/<mind> --graph think --json
   ```

5. If Git rejects the checkpoint tree with `Git command failed with code
   128`, inspect for legacy `_content_<oid>` anchors that point to blobs.
   The repair must preserve those anchors as blob entries in the new
   checkpoint tree.

6. Force a fresh materialize-and-checkpoint pass through the repaired path.
   The result should be a fresh schema-compatible checkpoint with zero
   patches since checkpoint.

7. Verify:

   ```sh
   npm run upgrade -- --repo ~/.think/<mind> --graph think --dry-run --json
   <mind>-think --remember --json
   <mind>-think --doctor --json
   git warp check --repo ~/.think/<mind> --graph think --json
   git warp doctor --repo ~/.think/<mind> --graph think --json
   ```

## Acceptance Criteria

- The repair command creates a dated backup under
  `refs/warp/think/checkpoints/pre-v17-upgrade-*` before mutating refs.
- A schema-outdated mind becomes readable by `<mind>-think --remember --json`.
- `git-warp` upgrade dry-run reports `already-current` after repair.
- A fresh checkpoint is written after materialization.
- `git warp check` reports `patchesSinceCheckpoint: 0`.
- `git warp doctor` reports zero failures. Warnings such as
  `COVERAGE_NO_REF` or `HOOKS_MISSING` may remain visible, but must be
  documented as post-repair hygiene rather than schema repair failure.
- The repair code includes a regression fixture for an old checkpoint whose
  `_content_<oid>` anchor points at a Git blob.
- The normal capture and remember runtime does not gain version-specific
  compatibility branches.

## Test Plan

- Golden: fixture mind with old checkpoint schema and legacy blob content
  anchors upgrades successfully.
- Golden: already-current mind exits cleanly and does not move checkpoint
  refs.
- Known fail before fix: stock checkpoint creation rejects a tree entry when
  `_content_<oid>` points to a blob object.
- Stress: large mind with thousands of thoughts and content anchors repairs
  without loading unrelated graph history into memory.
- Jitter: run repair twice; the second run must be idempotent and leave the
  mind readable.
- Doctor: repaired fixture has zero doctor failures and a fresh checkpoint.

## Evidence From 2026-05-05

The `~/.think/claude` mind failed re-entry after the git-warp v17 upgrade:

```sh
claude-think --remember --json
```

It reported a schema 4 checkpoint while v17 accepted only schema 5. A dry
run reported `would-upgrade`. A backup ref was created:

```text
refs/warp/think/checkpoints/pre-v17-upgrade-20260505-102848
  -> fe47a53d65e0bbdf98cd4a7546679c08f5ad074b
```

The stock migration failed because legacy content anchors were blob object
IDs. A controlled repair preserved those anchors as blob entries and wrote:

```text
91f65c5e2e3c75d1c503df778aa64aeb42b002bc
```

A later materialize-and-checkpoint pass created:

```text
7b05cfe4e9bdad5e25000b18a5b90400b727e440
```

That repaired checkpoint contained schema 5 metadata, 3,464 nodes, 3,683
edges, 33,590 properties, and zero patches since checkpoint. The final
doctor had zero failures, with only coverage-ref and hook-install warnings
remaining.

## Priority

Critical after any git-warp v17 dependency upgrade. Broken minds block the
core promise of Think: cheap capture, reliable re-entry, and durable agent
memory.
