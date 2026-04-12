---
id: CORE_ssjr-src-store-queries
blocks:
  - SURFACE_ssjr-src-cli-commands-read
  - REFLECT_ssjr-src-cli-commands-reflect
blocked_by:
  - CORE_ssjr-src-store-model
  - CORE_audit-unvalidated-read-models
  - CORE_audit-query-reshape-pipeline
  - CORE_ssjr-src-store-runtime
---

# Raise SSJR grades for `src/store/queries.js`

Current SSJR sanity check: `Hex C`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 C`.

The query layer reconstructs many domain records by hand and then re-shapes them again for callers. Move toward runtime-backed read models so query code returns trusted objects instead of repeatedly rebuilding loosely related plain-object views.
