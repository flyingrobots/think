# Raise SSJR grades for `bin/think.js`

Current SSJR sanity check: `Hex A`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`.

The CLI entrypoint is structurally correct, but it still depends on convention-heavy wiring. Keep the file narrowly host-facing and make sure command and error contracts remain derived from the owning runtime modules instead of being repeated here.
