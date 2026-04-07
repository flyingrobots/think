# Raise SSJR grades for `src/store/capture.js`

Current SSJR sanity check: `Hex C`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 C`.

Core capture persistence still operates on raw entry objects plus `kind`-based assumptions. Introduce real runtime-backed entry and provenance forms so construction, persistence, and follow-through stop depending on ambient shape trust.
