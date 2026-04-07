# Prompt metrics parsing is still a raw JSONL pipeline

`src/store/prompt-metrics.js` reads the whole file, parses line-by-line into anonymous objects, and lets downstream aggregation assume shape.

The failure mode is lenient, but the core contract stays soft and memory behavior will only get worse as the metrics file grows.
