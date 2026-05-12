---
title: "Ambient context and recall behavior are underdocumented"
legend: "CORE"
cycle: "0017-audit-undocumented-ambient-context-and-recall"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-undocumented-ambient-context-and-recall.md"
---

# Ambient context and recall behavior are underdocumented

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-undocumented-ambient-context-and-recall.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

A contributor can understand the ambient context and recall pipeline
from one document.

## Playback Questions

### Agent

- [ ] Does the doc exist in docs/?
- [ ] Does it explain collection, normalization, persistence, and recall matching?

## All postures

Not applicable — internal documentation.

## Backlog Context

The behavior that powers ambient capture context, remember scoring, and provenance flow is spread across `src/project-context.js`, `src/store/capture.js`, `src/store/queries.js`, and `src/capture-provenance.js`.

There is no single contributor-facing doc that explains what gets collected, when it gets normalized, and how it affects recall. That makes the behavior harder to change safely.
