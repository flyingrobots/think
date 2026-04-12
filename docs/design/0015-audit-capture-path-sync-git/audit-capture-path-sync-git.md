---
title: "Capture path still shells out to `git` synchronously"
legend: "CORE"
cycle: "0015-audit-capture-path-sync-git"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-capture-path-sync-git.md"
---

# Capture path still shells out to `git` synchronously

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-capture-path-sync-git.md`
Legend: CORE

## Sponsors

- Human: Backlog operator
- Agent: Implementation agent

## Hill

TBD

## Playback Questions

### Human

- [ ] TBD

### Agent

- [ ] TBD

## Accessibility and Assistive Reading

- Linear truth / reduced-complexity posture: TBD
- Non-visual or alternate-reading expectations: TBD

## Localization and Directionality

- Locale / wording / formatting assumptions: TBD
- Logical direction / layout assumptions: TBD

## Agent Inspectability and Explainability

- What must be explicit and deterministic for agents: TBD
- What must be attributable, evidenced, or governed: TBD

## Non-goals

- [ ] TBD

## Backlog Context

`saveRawCapture()` calls `getAmbientProjectContext(process.cwd())`, and that helper runs three `spawnSync('git', ...)` probes.

The capture path is supposed to be sacred. This host work belongs behind a bounded adapter or cache, not inline in persistence.
