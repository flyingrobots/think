# Raise SSJR grades for `src/browse-tui.js`

Current SSJR sanity check: `Hex B`, `P1 D`, `P2 C`, `P3 F`, `P4 C`, `P5 B`, `P6 C`, `P7 F`.

This is the clearest SURFACE-layer shape-soup hotspot. Action records, message records, and panel-state transitions are driven by tag switching instead of owned behavior. Split the file and move behavior onto runtime-backed model and action types so the TUI loop stops being a giant switchboard.
