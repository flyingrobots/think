---
title: "Multi-mind in one repo needs first-class graph identity"
captured_at: "2026-04-11"
source: "Codex architectural inspection"
status: "unprocessed"
---

# Multi-mind in one repo needs first-class graph identity

Current `think` supports multiple minds only by switching between separate git repos under `~/.think/`. The store and API substrate are still single-repo, single-chronology, and single-session-space:

- `THINK_REPO_DIR` / `getLocalRepoDir()` selects exactly one repo for capture, remember, browse, inspect, stats, migration, and MCP.
- Within that repo, chronology is global through `meta:graph -> latest_capture` plus one `older` chain.
- Session attribution is derived across all captures in the repo.
- `writerId` is host/CLI provenance, not a reliable mind or actor identity.

If Think eventually supports multiple minds inside one shared repo, `mind` needs to become first-class graph data, not just repo selection.

Recommended direction:

- Add `mindId` to persisted nodes that belong to a mind: captures, reflect entries, reflect sessions, session buckets, and derived artifacts.
- Keep `mindId` separate from `writerId`; ideally introduce explicit `actorId` provenance if per-agent authorship matters.
- Partition chronology by mind. The current single `latest_capture` edge and single `older` chain cannot stay global in a shared store.
- Partition session attribution by mind so one actor’s capture stream cannot merge into another actor’s session bucket just because timestamps are close.
- Thread mind selection through CLI and MCP surfaces with something like `THINK_MIND` / `--mind=<name>` and MCP tool parameters.
- Migrate existing single-mind repos by backfilling nodes into `mindId=default` and rebuilding per-mind chronology heads.

Lowest-risk rollout:

1. Keep `THINK_REPO_DIR` as the shared store selector.
2. Add `THINK_MIND` / `--mind` as the namespace selector inside that store.
3. Backfill existing data to `default`.
4. Only then collapse separate wrappers like `codex-think` and `claude-think` onto one shared repo if desired.

This feels like a clean extension of the current model without pretending that repo-level mind switching and graph-level mind partitioning are the same problem.
