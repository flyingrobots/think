# Raise SSJR grades for `src/store/model.js`

Current SSJR sanity check: `Hex D`, `P1 F`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 C`.

This is the worst core modeling hotspot. Meaning-heavy concepts like entries and sessions are still emitted as plain objects with loose `kind` fields. Start by introducing real domain types for entries, sessions, and related identifiers so construction establishes trust instead of downstream code patching shape assumptions together.
