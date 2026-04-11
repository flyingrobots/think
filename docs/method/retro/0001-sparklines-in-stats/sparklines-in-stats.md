---
title: "Sparklines in stats output"
cycle: "0001-sparklines-in-stats"
design_doc: "docs/design/0001-sparklines-in-stats/sparklines-in-stats.md"
outcome: hill-met
drift_check: yes
---

# Sparklines in stats output Retro

## Summary

Wired bijou v4.4.0's `sparkline()` into Think's stats pipeline. All
three output surfaces — CLI text, CLI JSON, and MCP formatted — now
include a sparkline when bucketed stats are requested. The sparkline
renders oldest-to-newest (left-to-right), reversing the bucket order
from `getStats()`.

Clean cycle. No surprises. The only snag was `output.out()` emitting
a `cli.output` event in JSON mode for the sparkline text line, which
broke an existing event-sequence assertion. Fixed by gating the text
line behind `!output.json` since the sparkline data is already in the
`stats.total` event payload.

## Playback Witness

- [verification.md](witness/verification.md) — automated test run
  (143 pass, 0 fail) and drift check.
- CLI text witness: `node bin/think.js --stats --bucket=day` shows
  `Capture frequency: ▂▇█▃▃▃▁▁▁▁▁▁` after the bucket table.
- CLI JSON witness: `stats.total` event includes `"sparkline":"▅"`.
- MCP witness: `formatStats()` appends sparkline line after table.

## Drift

- None. No undocumented changes outside the design scope.

## New Debt

- None recorded.

## Cool Ideas

- None recorded.

## Backlog Maintenance

- [x] Inbox processed — two remaining items (splash dead code, BG_TOKEN)
- [x] Priorities reviewed
- [x] Dead work buried or merged
