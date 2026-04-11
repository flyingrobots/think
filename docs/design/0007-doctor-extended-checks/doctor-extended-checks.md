---
title: "Doctor: extended health checks"
legend: "CORE"
cycle: "0007-doctor-extended-checks"
source_backlog: "docs/method/backlog/v0.7.0/CORE_doctor-extended-checks.md"
---

# Doctor: extended health checks

Source backlog item: `docs/method/backlog/v0.7.0/CORE_doctor-extended-checks.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`think --doctor` reports graph model version and entry count alongside
the existing directory and repo checks.

## Playback Questions

### Human

- [ ] Does doctor show the graph model version?
- [ ] Does doctor show how many thoughts I have?

### Agent

- [ ] Does graph_model check warn when migration is needed?
- [ ] Does entry_count check warn when there are zero entries?
- [ ] Do the new checks appear in --json and MCP output?

## Accessibility and Assistive Reading

- Same as cycle 0005 — labeled pass/fail text.

## Localization and Directionality

- Not applicable.

## Agent Inspectability and Explainability

- New checks follow the same `{ name, status, message }` schema.

## Non-goals

- No graph repair — just diagnosis.

## Design

`runDiagnostics` currently takes `{ thinkDir, repoDir, upstreamUrl }`.
The new checks need async store access (`getGraphModelStatus`,
`getStats`). Make `runDiagnostics` async (or accept pre-fetched data).

Cleanest: pass optional async callbacks so the core stays testable
without real repos. For production, `checkThinkHealth` in service.js
and `runDoctor` in read.js supply the real implementations.
