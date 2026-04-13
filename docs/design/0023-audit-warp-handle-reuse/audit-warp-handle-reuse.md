---
title: "openWarpApp handle reuse"
legend: "CORE"
cycle: "0023-audit-warp-handle-reuse"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-warp-handle-reuse.md"
---

# openWarpApp handle reuse

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-warp-handle-reuse.md`
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

`openWarpApp` is called multiple times across `saveRawCapture` and
`finalizeCapturedThought`, creating redundant repository handles.
Implement a simple singleton cache in `src/store/runtime.js` that
reuses open app handles for the same `repoDir` during a single
execution tick.

Source: code-quality audit 2026-04-11 §4.2.
