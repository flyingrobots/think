---
title: "Core entry and session concepts are still plain objects"
legend: "CORE"
cycle: "0012-audit-plain-object-model"
source_backlog: "docs/method/backlog/bad-code/CORE_audit-plain-object-model.md"
---

# Core entry and session concepts are still plain objects

Source backlog item: `docs/method/backlog/bad-code/CORE_audit-plain-object-model.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`createEntry` and `createReflectSession` return domain class instances
with validated construction, not anonymous bags.

## Playback Questions

### Agent

- [ ] Are `Entry` and `ReflectSession` classes with constructor validation?
- [ ] Can existing callers use them without changing property access?
- [ ] Do all existing tests pass unchanged?

## All postures

Not applicable — internal refactor, no behavior change.

## Non-goals

- Not migrating consumers to use instanceof checks yet (that's the
  next cycle: CORE_ssjr-src-store-model)
- Not adding methods to the classes yet — fields only

## Design

Replace the two factory functions with classes:

```js
class Entry {
  constructor(text, writerId, { kind, source }) {
    // validate, assign fields, freeze
  }
}

class ReflectSession {
  constructor(writerId, { seedEntryId, ... }) {
    // validate, assign fields, freeze
  }
}
```

Callers continue to use `entry.id`, `entry.text`, etc. — property
access is identical. The classes are frozen to preserve immutability.

Two callers for each: `capture.js` and `reflect.js`. 164 property
accesses across 18 files remain unchanged.
