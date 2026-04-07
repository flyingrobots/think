# Raise SSJR grades for `src/store/runtime.js`

Current SSJR sanity check: `Hex C`, `P1 D`, `P2 D`, `P3 C`, `P4 D`, `P5 B`, `P6 B`, `P7 D`.

This file is the core/runtime seam with the most architectural strain. It mixes graph access, host-specific opening, raw prop normalization, and `kind`-driven reconstruction of domain meaning. Break it up and introduce typed read models so the runtime seam stops leaking host details and shape soup into the store core.
