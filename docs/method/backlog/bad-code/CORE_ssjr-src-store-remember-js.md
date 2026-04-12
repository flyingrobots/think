---
id: CORE_ssjr-src-store-remember
blocks: []
blocked_by:
  - CORE_ssjr-src-store-runtime
  - CORE_audit-undocumented-ambient-context-and-recall
---

# Raise SSJR grades for `src/store/remember.js`

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 B`, `P3 B`, `P4 B`, `P6 B`, `P7 B`.

Remember matching is coherent, but scopes and matches are still plain objects with implied invariants. Introduce explicit runtime-backed scope and match forms so ranking and recall receipts are less dependent on convention.
