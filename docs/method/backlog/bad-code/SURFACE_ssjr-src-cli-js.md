# Raise SSJR grades for `src/cli.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P2 B`, `P3 C`, `P4 B`, `P6 B`, `P7 C`.

The top-level dispatcher still routes through command strings and a long conditional chain. Move toward command objects or a command registry that owns behavior so the CLI shell becomes thinner and less tag-oriented.
