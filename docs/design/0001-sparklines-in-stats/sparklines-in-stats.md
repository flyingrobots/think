---
title: "Sparklines in stats output"
legend: "SURFACE"
cycle: "0001-sparklines-in-stats"
source_backlog: "docs/method/backlog/inbox/SURFACE_sparklines-in-stats.md"
---

# Sparklines in stats output

Source backlog item: `docs/method/backlog/inbox/SURFACE_sparklines-in-stats.md`
Legend: SURFACE

## Sponsors

- Human: James
- Agent: Claude

## Hill

When a user runs `think --stats` with buckets, they see a sparkline of
capture frequency alongside the bucket table — no extra flags needed.

## Playback Questions

### Human

- [ ] Does the sparkline show capture patterns at a glance?
- [ ] Does `--json` output include the sparkline string so agents can
      display it?

### Agent

- [ ] Does the MCP `stats` tool include a sparkline in its formatted
      text output?
- [ ] Are empty and single-bucket edge cases handled without crashing?
- [ ] Does the sparkline degrade gracefully when there are no buckets?

## Accessibility and Assistive Reading

- Linear truth: The sparkline is additive decoration. The bucket table
  with numeric counts remains the primary data surface. Screen readers
  see the table; the sparkline is supplementary.
- Non-visual: No change to `--json` semantics — the sparkline string
  is an additional field, not a replacement for numeric data.

## Localization and Directionality

- Sparklines are left-to-right (oldest → newest) regardless of locale.
  This matches the temporal axis convention in the Unicode block
  character set. No RTL concern — this is a chart, not text.
- Bucket keys already use ISO 8601 dates. No change.

## Agent Inspectability and Explainability

- The `--json` output adds a `sparkline` field to the `stats.total`
  event so agents can render or forward it.
- The MCP formatted output includes the sparkline as a text line.
  Agents reading the MCP response get both the table and the sparkline.

## Non-goals

- No interactive sparkline (hover, zoom, pan)
- No braille chart (`brailleChartSurface`) — sparkline is sufficient
  for this summary view
- No new CLI flags — sparklines appear automatically when buckets are
  present
- No browse TUI changes in this cycle

## Design

### Data flow

Buckets arrive from `getStats()` sorted newest-first. Sparkline
expects oldest-first (left = past, right = present). Reverse the
bucket counts array before passing to `sparkline()`.

```
getStats() → { total, buckets: [{key, count}, ...] }  (newest-first)
    ↓
buckets.map(b => b.count).reverse()  →  [oldest, ..., newest]
    ↓
sparkline(values)  →  "▁▃▅▇█▅▃▁"
```

### CLI text output

After the bucket table, append:

```
Capture frequency: ▁▃▅▇█▅▃▁
```

### CLI JSON output

Add `sparkline` field to the `stats.total` event:

```json
{"event":"stats.total","total":42,"sparkline":"▁▃▅▇█▅▃▁","message":"Total thoughts: 42"}
```

When no buckets are requested, `sparkline` is omitted.

### MCP formatted output

Append the sparkline line after the table in `formatStats()`.

### Edge cases

- No buckets requested → no sparkline
- Single bucket → single block character (valid)
- All buckets same count → flat line `▄▄▄▄▄` (mid-height)
- Empty result (0 total) → no sparkline
