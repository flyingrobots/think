# Prompt metrics testability: IOPort abstraction

Testing macOS panel telemetry requires reading from a physical
`.jsonl` file on disk. Refactor `prompt-metrics.js` to accept an
optional IOPort that abstracts the filesystem, allowing tests to
run against in-memory buffers.

Source: code-quality audit 2026-04-11 §3.3.
