---
id: CORE_runtime-truth-standard-ratchet
blocks: []
blocked_by: []
---

# Runtime Truth ratchet is active; full hard gates remain

`docs/INFRASTRUCTURE_DOCTRINE.md` now defines strict Runtime Truth
architecture and code-shape rules. A measured baseline on 2026-05-13
showed that applying the proposed JavaScript size and complexity rules
would report 195 violations across 47 files with the default ESLint
ignore profile.

The first executable ratchet now lives in
`scripts/runtime-truth-ratchet.mjs` and runs from `npm run lint`. Its
committed baseline uses `--no-ignore` against tracked JavaScript files,
so it also accounts for benchmarks:

- 200 strict-limit violations total.
- 150 source/script violations.
- 45 test violations.
- 5 benchmark violations.
- 0 generic source `Error`/`TypeError` throws.

New work should not increase the ratcheted counts while legacy hotspots
are paid down deliberately.

## Acceptance Criteria

- [x] Add a committed strict-limits report or baseline generated from the
  same rule set used in `docs/audit/2026-05-13_runtime-truth-code-standard.md`.
- [x] CI fails when a PR adds new or worsened violations.
- [x] The ratchet separately reports source, test, and benchmark violations.
- [x] CI fails if source reintroduces generic `throw new Error(...)` or
  `throw new TypeError(...)`.
- [ ] Once source violations reach zero, the strict limits move into
  `eslint.config.js` as hard errors for JavaScript.
- [ ] TypeScript-specific unsafe-type rules are added when TypeScript source
  enters the repo.
- [ ] A Swift equivalent is chosen for file/function/complexity limits.
