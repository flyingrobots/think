---
title: "Raise SSJR grades for `src/store/model.js`"
legend: "CORE"
cycle: "0013-ssjr-src-store-model-js"
source_backlog: "docs/method/backlog/bad-code/CORE_ssjr-src-store-model-js.md"
---

# Raise SSJR grades for `src/store/model.js`

Source backlog item: `docs/method/backlog/bad-code/CORE_ssjr-src-store-model-js.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`src/store/model.js` uses validated domain constants for entry kinds
and bucket periods instead of magic strings, and does not read
process globals directly.

## Playback Questions

### Agent

- [ ] Are ENTRY_KINDS and BUCKET_PERIODS exported validated sets?
- [ ] Does `getCurrentTime` no longer read `process.env` directly?
- [ ] Does `createWriterId` no longer read `os.hostname` directly?
- [ ] Do all existing tests pass?

## All postures

Not applicable — internal refactor.

## Non-goals

- Not moving comparators onto Entry (methods cycle)
- Not changing the public function signatures

## Backlog Context

Current SSJR sanity check: `Hex D`, `P1 F`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 C`.

This is the worst core modeling hotspot. Meaning-heavy concepts like entries and sessions are still emitted as plain objects with loose `kind` fields. Start by introducing real domain types for entries, sessions, and related identifiers so construction establishes trust instead of downstream code patching shape assumptions together.
