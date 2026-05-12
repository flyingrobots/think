---
title: "Store runtime reconstructs trusted entries from raw graph props"
legend: "CORE"
cycle: "0019-audit-unvalidated-read-models"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-unvalidated-read-models.md"
---

# Store runtime reconstructs trusted entries from raw graph props

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-unvalidated-read-models.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`getStoredEntry` returns a frozen `StoredEntry` class with validated
fields instead of a raw property bag.

## Playback Questions

### Agent

- [ ] Is `StoredEntry` a class with Object.freeze?
- [ ] Do all existing tests pass unchanged?

## All postures

Not applicable — internal refactor.

## Backlog Context

`src/store/runtime.js` turns raw graph node properties directly into store entry objects without a schema or runtime-backed constructor boundary.

This is a core correctness risk because every read surface downstream inherits whatever that raw graph shape happens to be.
