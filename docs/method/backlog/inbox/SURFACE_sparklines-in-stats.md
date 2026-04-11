# Sparklines in stats output

Bijou v4.4.0 ships `sparkline(values, opts)` — Unicode block charts
(▁▂▃▄▅▆▇█) from an array of numbers. Think already computes bucketed
time-series data (thought counts by day/hour/week) in `--stats` and
the MCP `stats` tool. Wire sparklines into the stats output so capture
frequency is visible at a glance.

## Scope

- CLI `--stats` output (plain text and `--json`)
- MCP `stats` tool formatted output
- Browse TUI stats panel (if one exists or is introduced)

## Why now

Bijou 4.4.0 just landed in Think (commit 8bccad8). The data is already
there; this is a presentation upgrade.
