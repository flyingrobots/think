---
title: "Git execution still trusts ambient PATH lookup"
legend: "CORE"
cycle: "0021-audit-git-binary-path-trust"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-git-binary-path-trust.md"
---

# Git execution still trusts ambient PATH lookup

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-git-binary-path-trust.md`
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

Think invokes `git` by bare command name from `src/project-context.js` and `src/git.js`.

That is acceptable for a local developer tool until it is not. The repo should resolve and trust one Git binary intentionally instead of inheriting whatever PATH happens to provide.
