---
id: PROCESS_backlog-dependency-integrity-check
blocks: []
blocked_by: []
---

# Backlog dependency references are not mechanically checked

Think backlog cards use `id`, `blocks`, and `blocked_by` front matter, but the
repo does not currently appear to enforce that those references are valid.

The Think-on-Echo phase map now relies on that graph being readable. A typo,
duplicate id, missing file, stale blocker, or self-reference would make the
planning map quietly misleading.

## Why

The backlog is now doing real coordination work, not just collecting loose
ideas. If agents and humans are going to use `blocks` / `blocked_by` to choose
the next METHOD cycle, those edges need a cheap guard.

## Acceptance Criteria

- A docs consistency test scans backlog front matter.
- Every `id` is unique across backlog lanes.
- Every `blocks` and `blocked_by` entry points at an existing backlog id.
- The test rejects self-blocking edges.
- The test output names the broken file and missing/stale id.
- Existing backlog files pass without requiring a taxonomy rewrite.
