# Raise SSJR grades for `src/capture-provenance.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P3 B`, `P6 B`.

The boundary normalization is disciplined, but provenance is still just a plain object. Introduce a small runtime-backed provenance form so the invariant lives on the value instead of in helper conventions spread across callers.
