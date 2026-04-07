# Bearing

Updated: 2026-04-06

## Where are we going?

Validation and hardening. `v0.5.0` is released. METHOD is adopted. Recent cycles have focused on capture-latency measurement, warm-path hardening, and adapter cleanup.

## What just shipped?

Cycle 0008 — pruned stale `bad-code` backlog debt. The shipped shared-path-search and CONTRIBUTING refresh slices are no longer listed as open bad-code work, and release-discipline wording is now aligned across the current METHOD docs.

## What feels wrong?

- **~2 seconds per capture is slow.** The benchmark reveals that CLI capture is dominated by Node startup and WARP graph overhead. A profiling cycle could find optimization targets.
- **Shape soup in the MCP service layer.** Plain objects, no runtime-backed domain types. SSJD debt.
- **The remaining up-next items are all observation/validation work.** That's correct for this phase.
