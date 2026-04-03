# Bearing

Updated: 2026-04-03

## Where are we going?

Validation and hardening. `v0.5.0` is released. METHOD is adopted. Cycle 0001 (capture latency benchmark) is complete — first METHOD cycle closed with a full retro.

## What just shipped?

Cycle 0001 — capture latency benchmark. Warm-path CLI capture measures ~2s median end-to-end. Baseline committed.

## What feels wrong?

- **~2 seconds per capture is slow.** The benchmark reveals that CLI capture is dominated by Node startup and WARP graph overhead. A profiling cycle could find optimization targets.
- **Shape soup in the MCP service layer.** Plain objects, no runtime-backed domain types. SSJD debt.
- **CONTRIBUTING.md is drifting.** Still references the old milestone loop and IBM Design Thinking framing. Should be updated to reflect METHOD.
- **The remaining up-next items are all observation/validation work.** That's correct for this phase.
