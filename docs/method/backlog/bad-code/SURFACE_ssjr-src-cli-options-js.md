# Raise SSJR grades for `src/cli/options.js`

Current SSJR sanity check: `Hex B`, `P1 C`, `P2 B`, `P3 C`, `P4 B`, `P6 C`, `P7 C`.

The parser currently produces a large mutable-feeling options bag and command resolution depends on stringly post-processing. Introduce explicit parsed-command and parsed-option forms so validation and dispatch stop depending on shape soup.
