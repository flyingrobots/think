---
id: SURFACE_ssjr-src-verbose
blocks:
  - SURFACE_ssjr-src-cli-commands-capture
  - SURFACE_ssjr-src-cli-commands-read
blocked_by: []
---

# Raise SSJR grades for `src/verbose.js`

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`.

The reporter is small and stable, but event payloads are still just shaped objects. Tighten the reporting contract so event names and payload structure derive from one runtime-backed source of truth instead of ambient convention.
