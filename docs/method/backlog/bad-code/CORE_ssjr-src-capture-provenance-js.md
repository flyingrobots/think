---
id: CORE_ssjr-src-capture-provenance
blocks:
  - CORE_ssjr-src-store-capture
  - SURFACE_ssjr-src-cli-commands-capture
blocked_by:
  - CORE_audit-provenance-url-schemes
  - CORE_audit-capture-path-sync-git
---

# Raise SSJR grades for `src/capture-provenance.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P3 B`, `P6 B`.

The boundary normalization is disciplined, but provenance is still just a plain object. Introduce a small runtime-backed provenance form so the invariant lives on the value instead of in helper conventions spread across callers.
