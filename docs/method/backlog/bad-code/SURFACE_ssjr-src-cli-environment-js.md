# Raise SSJR grades for `src/cli/environment.js`

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`.

This file is small and well-placed, but it still exposes ambient booleans and raw environment reads as loose helpers. A tiny runtime-backed environment capability object would make these decisions less ad hoc.
