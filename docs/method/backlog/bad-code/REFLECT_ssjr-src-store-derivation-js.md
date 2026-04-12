---
id: REFLECT_ssjr-src-store-derivation
blocks: []
blocked_by:
  - CORE_ssjr-src-store-model
  - CORE_ssjr-src-store-capture
  - RE-025-deferred-derivation-pipeline
---

# Raise SSJR grades for `src/store/derivation.js`

Current SSJR sanity check: `Hex B`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 D`.

Derived artifacts and receipts are currently raw objects with a lot of `kind`-driven branching. Pull seed quality, session attribution, and derived receipt concepts into runtime-backed forms so reflect derivation is less dependent on tag-switching.
