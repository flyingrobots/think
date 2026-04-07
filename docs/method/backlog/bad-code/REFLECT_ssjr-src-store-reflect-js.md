# Raise SSJR grades for `src/store/reflect.js`

Current SSJR sanity check: `Hex B`, `P1 D`, `P2 C`, `P3 C`, `P4 C`, `P5 B`, `P6 B`, `P7 D`.

Reflect sessions and entries are still modeled as mutable-looking raw objects plus `kind` checks. Introduce runtime-backed session, prompt-plan, and reflect-entry forms so reflect behavior lives on owned types instead of being spread across patch logic and conditionals.
