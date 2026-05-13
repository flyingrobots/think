---
id: CORE_runtime-truth-standard-ratchet
blocks: []
blocked_by: []
---

# Runtime Truth standard is documented but not enforced

`docs/INFRASTRUCTURE_DOCTRINE.md` now defines strict Runtime Truth
architecture and code-shape rules. A measured baseline on 2026-05-13
showed that applying the proposed JavaScript size and complexity rules
would currently report 195 violations across 47 files.

The standard must become executable without breaking the repo all at
once. New work should not increase the violation count while legacy
hotspots are paid down deliberately.

## Acceptance Criteria

- Add a committed strict-limits report or baseline generated from the
  same rule set used in `docs/audit/2026-05-13_runtime-truth-code-standard.md`.
- CI fails when a PR adds new or worsened violations.
- The ratchet separately reports source, test, and benchmark violations.
- Once source violations reach zero, the strict limits move into
  `eslint.config.js` as hard errors for JavaScript.
- TypeScript-specific unsafe-type rules are added when TypeScript source
  enters the repo.
- A Swift equivalent is chosen for file/function/complexity limits.
