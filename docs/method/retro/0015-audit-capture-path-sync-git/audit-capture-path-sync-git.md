---
title: "Move ambient context out of store"
cycle: "0015-audit-capture-path-sync-git"
outcome: hill-met
drift_check: yes
---

# Move ambient context out of store Retro

## Summary

Removed process.cwd() and getAmbientProjectContext fallback from
saveRawCapture and finalizeCapturedThought. CLI and MCP callers now
resolve ambient context at the boundary. Port test updated to pass
ambientContext directly. 187 tests pass.

## Drift

- None.
