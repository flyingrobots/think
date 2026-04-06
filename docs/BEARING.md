# Bearing

Updated: 2026-04-06

## Where are we going?

Validation and hardening. `v0.5.0` is released. METHOD is adopted. Recent cycles have focused on capture-latency measurement, warm-path hardening, and adapter cleanup.

## What just shipped?

Cycle 0007 — shared Swift path search. The macOS CLI and MCP resolvers now share one path-search utility with direct resolver tests for explicit path, repo-root, bundle, and process-directory lookup.

## What feels wrong?

- **~2 seconds per capture is slow.** The benchmark reveals that CLI capture is dominated by Node startup and WARP graph overhead. A profiling cycle could find optimization targets.
- **Shape soup in the MCP service layer.** Plain objects, no runtime-backed domain types. SSJD debt.
- **CONTRIBUTING.md is drifting.** Still references the old milestone loop and IBM Design Thinking framing. Should be updated to reflect METHOD.
- **The remaining up-next items are all observation/validation work.** That's correct for this phase.
