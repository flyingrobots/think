# Raise SSJR grades for `src/cli/commands/read.js`

Current SSJR sanity check: `Hex C`, `P1 C`, `P2 B`, `P3 D`, `P4 B`, `P5 B`, `P6 C`, `P7 D`.

This command surface is doing too much with too many raw result shapes. Split command-specific presentation into smaller owned modules and replace command/result switching with behavior that lives on the types or handlers that own it.
