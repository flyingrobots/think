# Capture latency has no enforced regression gate

The repo has capture benchmarks and the bearing doc explicitly calls capture latency out as a concern, but CI does not enforce a stable latency budget.

That means the most sacred user journey can degrade without a hard signal.
