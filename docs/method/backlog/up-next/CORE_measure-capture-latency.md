# Measure capture latency honestly

Add a small benchmark harness for warm-path local capture. Decide later whether any latency aggregates belong in `think --stats`; if they do, keep them factual and boring. Keep this as measurement and regression detection, not a flaky timing assertion in the deterministic suite.
