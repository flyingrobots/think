---
title: "Doctor checks have inconsistent skip logic"
legend: "CORE"
cycle: "0011-doctor-inconsistent-skip-logic"
source_backlog: "docs/method/backlog/bad-code/CORE_doctor-inconsistent-skip-logic.md"
---

# Doctor checks have inconsistent skip logic

Source backlog item: `docs/method/backlog/bad-code/CORE_doctor-inconsistent-skip-logic.md`
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

Graph model and entry count checks skip when `repoOk` is false OR
callback is missing. But upstream reports "ok" when URL is set but
no `checkUpstreamReachable` callback is provided — giving false
confidence that the upstream was validated.

Standardize: all checks should skip if they lack the means to verify.

File: `src/doctor.js`
