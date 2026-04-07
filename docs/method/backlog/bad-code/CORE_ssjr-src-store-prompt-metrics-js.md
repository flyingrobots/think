# Raise SSJR grades for `src/store/prompt-metrics.js`

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 C`, `P3 B`, `P4 C`, `P6 B`, `P7 B`.

Prompt metrics are handled as tolerant raw records, which is useful at the boundary but too loose in the core summarization path. Introduce an explicit parsed metric record form so invalid lines are rejected once and downstream aggregation deals in trusted values.
