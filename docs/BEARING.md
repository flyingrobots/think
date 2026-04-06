# Bearing

Updated: 2026-04-06

## Where are we going?

Validation and hardening. `v0.5.0` is released. METHOD is adopted. Cycle 0001 (capture latency benchmark) is complete — first METHOD cycle closed with a full retro.

## What just shipped?

Cycle 0006 — contributor docs refresh. `CONTRIBUTING.md` now reflects METHOD, current repo references, and current release/verification guidance.

## What feels wrong?

- **~2 seconds per capture is slow.** The benchmark reveals that CLI capture is dominated by Node startup and WARP graph overhead. A profiling cycle could find optimization targets.
- **Shape soup in the MCP service layer.** Plain objects, no runtime-backed domain types. SSJD debt.
- **The remaining up-next items are all observation/validation work.** That's correct for this phase.
