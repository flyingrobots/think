---
title: "Warp handle reuse"
cycle: "0023-audit-warp-handle-reuse"
outcome: hill-met
drift_check: yes
---

# Warp handle reuse Retro

## Summary

Added a Map cache in runtime.js keyed by repoDir. openWarpApp returns
the cached instance on subsequent calls. 7 call sites benefit.

## Drift

- None.
