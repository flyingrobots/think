# Raise SSJR grades for `src/git.js`

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`, `P7 B`.

This adapter is in the right layer, but push/init outcomes and retry semantics are still mostly plain-object conventions. Introduce a few explicit runtime-backed outcomes or error types so callers stop interpreting raw shell results directly.
