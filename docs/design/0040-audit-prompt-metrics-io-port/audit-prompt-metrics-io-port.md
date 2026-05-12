---
title: "Prompt metrics testability: IOPort abstraction"
legend: "CORE"
cycle: "0040-audit-prompt-metrics-io-port"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-prompt-metrics-io-port.md"
---

# Prompt metrics testability: IOPort abstraction

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-prompt-metrics-io-port.md`
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

Testing macOS panel telemetry requires reading from a physical
`.jsonl` file on disk. Refactor `prompt-metrics.js` to accept an
optional IOPort that abstracts the filesystem, allowing tests to
run against in-memory buffers.

Source: code-quality audit 2026-04-11 §3.3.
