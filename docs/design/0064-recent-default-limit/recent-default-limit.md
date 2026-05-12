---
title: "--recent loads entire history by default"
legend: "CORE"
cycle: "0064-recent-default-limit"
source_backlog: "docs/method/backlog/asap/CORE_recent-default-limit.md"
---

# --recent loads entire history by default

Source backlog item: `docs/method/backlog/asap/CORE_recent-default-limit.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`--recent` shows a bounded window with a total count, not the
entire archive.

## Playback Questions

### Agent

- [ ] Does --recent without --count default to 50?
- [ ] Does text output show a trailer with total count?
- [ ] Does --json output include a total count?
- [ ] Does --count=N still override the default?

## All postures

Not applicable — bugfix.

## Non-goals

- Not fixing the capture buffer limit (git-warp issue)

## Backlog Context

`listRecent` calls `listEntriesByKind(read, 'capture')` which
materializes every capture in the graph. With a large repo (317MB
codex mind), this hits the git-warp 10MB buffer limit.

Fix: default to last 50 entries. Show total count in output so the
user knows how many more exist. `--count=N` already works for
explicit limits.

Output should include a trailer:
```
(showing 50 of 1234 captures)
```

Triggered by: codex-think capture failing with "Buffer limit
exceeded: 10485760 bytes" on a 317MB repo.
