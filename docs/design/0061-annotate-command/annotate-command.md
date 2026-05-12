---
title: "think --annotate"
legend: "CORE"
cycle: "0061-annotate-command"
source_backlog: "docs/method/backlog/asap/CORE_annotate-command.md"
---

# think --annotate

Source backlog item: `docs/method/backlog/asap/CORE_annotate-command.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

A user can attach a note to an existing capture via `--annotate`
and see it when inspecting that entry.

## Playback Questions

### Human

- [ ] Can I annotate a capture from the CLI?
- [ ] Does --inspect show annotations?

### Agent

- [ ] Does --json --annotate emit structured JSONL?
- [ ] Does the annotation create a graph node with an annotates edge?
- [ ] Does annotation text survive as attached content?
- [ ] Does annotation reject empty text?
- [ ] Does annotation reject a nonexistent entry?

## All postures

Not applicable — CLI command, no visual/locale concern.

## Non-goals

- No browse TUI `a` key in this cycle (follow-up)
- No MCP tool in this cycle (follow-up)

## Backlog Context

First enrichment surface. Attach a user-authored note to an existing
capture without mutating the original.

```
think --annotate=<entryId> "this turned out to be wrong"
```

New node: `annotation:<sortKey-uuid>` with `annotates` edge to the
target entry. CLI text, --json, MCP tool, and browse TUI (`a` key).

Design: docs/design/enrichment-pipeline.md (step 2)
