# Raise SSJR grades for `src/store.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P2 B`, `P3 B`, `P4 B`.

The barrel is convenient, but it is also a soft-contract choke point. Keep the export surface intentional and derived from the owning modules so the store API does not drift into an undifferentiated namespace.
