---
title: "Unused browseStartMs field in windowed model"
legend: "CORE"
cycle: "0011-unused-browseStartMs-field"
source_backlog: "docs/method/backlog/bad-code/CORE_unused-browseStartMs-field.md"
---

# Unused browseStartMs field in windowed model

Source backlog item: `docs/method/backlog/bad-code/CORE_unused-browseStartMs-field.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

No dead fields in the browse model.

## Playback Questions

### Agent

- [ ] Is `browseStartMs` absent from model.js?

## All postures

Not applicable — dead code removal.

## Backlog Context

`browseStartMs` was added to the windowed browse model during cycle
0004 for a fade-in approach that was later replaced. The field is set
in `createWindowedBrowseModel` but never read. Remove it.
