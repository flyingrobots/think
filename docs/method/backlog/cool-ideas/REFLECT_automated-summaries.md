# Automated thought summaries

Summarize sessions, days, weeks, months, or topics automatically.

```
think --summarize --session=<sessionId>    # what happened in this session
think --summarize --since=1d               # today's thinking
think --summarize --since=7d               # this week
think --summarize --since=30d              # this month
think --summarize --topic=architecture     # all thoughts on a topic
```

## Output

A new derived entry with `kind: 'summary'` linked to the source
entries via `summarizes` edges. The summary is itself a thought in
the archive — browsable, annotatable, evolvable.

## Levels

### Session summary
"In this 20-minute session you explored X, questioned Y, and
decided Z." Derived from the session's capture sequence.

### Daily/weekly/monthly digest
Aggregate across sessions. Identify recurring themes, open
questions that haven't been resolved, decisions made, and shifts
in thinking over time.

### Topic summary
Cross-temporal synthesis on a single topic. "Your thinking about
performance has evolved from concern about ESM load time (March)
to graph-level optimization (April)."

## Architecture

Summaries are derived entries — immutable, linked, inspectable.
Each summary records its source entries, time window, and generation
method in provenance.

Two modes:
- **Deterministic**: session summaries from capture sequence and
  semantic parse artifacts (no LLM needed)
- **LLM-assisted**: richer narrative summaries with explicit
  LLM provenance

Could run on a schedule ("generate daily digest at midnight") or
on demand.
