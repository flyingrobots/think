---
title: "think --doctor"
cycle: "0005-think-doctor"
design_doc: "docs/design/0005-think-doctor/think-doctor.md"
outcome: hill-met
drift_check: yes
---

# think --doctor Retro

## Summary

Shipped `think --doctor` as a health check command. Three checks:
think directory, local repo, and upstream config. CLI text output
uses ✓/✗/○ symbols. `--json` emits `doctor.result` with a checks
array. Consolidated three duplicate backlog items into this cycle.

Clean cycle. Core logic is in `src/doctor.js` (pure, no CLI deps),
wired through options → cli → read.js. 10 tests (6 port + 4
acceptance).

## Playback Witness

- [verification.md](witness/verification.md) — 165 pass, 0 fail.
- CLI text: `✓ Think directory exists`, `✓ Local repo is a valid git repo`, `○ Upstream not configured`
- CLI JSON: `doctor.result` event with checks array.

## Drift

- None.

## New Debt

- MCP `doctor` tool not yet wired (design doc mentions it). Could be
  a follow-up.
- Graph model version and entry count checks mentioned in design but
  not yet implemented (kept scope minimal for first cut).

## Cool Ideas

- `think --doctor --fix` — auto-repair mode that runs migration, etc.

## Backlog Maintenance

- [x] Consolidated CORE_doctor-health-snapshot and CORE_audit-no-doctor-command
- [x] Inbox processed
- [x] Dead work buried or merged
