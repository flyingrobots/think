---
id: SURFACE_ssjr-src-cli-commands-capture
blocks: []
blocked_by:
  - CORE_ssjr-src-capture-provenance
  - SURFACE_ssjr-src-cli-options
  - SURFACE_ssjr-src-verbose
---

# Raise SSJR grades for `src/cli/commands/capture.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P2 B`, `P3 C`, `P4 B`, `P6 B`, `P7 B`.

Capture orchestration is solid, but it still returns and reports mostly raw outcome shapes. Introduce explicit capture result forms so persistence, migration follow-through, and backup reporting stop leaning on ambient object conventions.
