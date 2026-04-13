---
title: "SSJR for src/store/capture.js"
cycle: "0018-ssjr-src-store-capture-js"
outcome: hill-met
drift_check: yes
---

# SSJR for src/store/capture.js Retro

## Summary

Removed pointless captureAmbientContext alias. File is now clean:
Entry class for construction, CaptureProvenance class for normalization,
ambient context passed from boundary. 63 port tests pass.

## Drift

- Discovered stale blocked_by dependency on project-context — removed.

## New Debt

- getGraphModelStatus is misplaced in capture.js (belongs in runtime
  or its own module). Not worth moving this cycle due to barrel export.
