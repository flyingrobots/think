# Raise SSJR grades for `src/store/migrations.js`

Current SSJR sanity check: `Hex B`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P6 B`, `P7 D`.

The migration engine is graph-correct, but it reasons about node meaning almost entirely through raw props and `kind` checks. Introduce typed migration facts or per-kind migration helpers so the updater stops being a large conditional over graph shapes.
