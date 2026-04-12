---
id: CORE_ssjr-src-project-context
blocks:
  - CORE_ssjr-src-store-capture
blocked_by:
  - CORE_audit-undocumented-ambient-context-and-recall
  - CORE_ssjr-src-git
---

# Raise SSJR grades for `src/project-context.js`

Current SSJR sanity check: `Hex A`, `P1 C`, `P2 B`, `P3 B`, `P4 C`, `P6 B`.

Ambient project context is useful, but it is still represented as a raw bag of strings and token arrays. Give the context a firmer runtime-backed shape so project-name, token, and query-term invariants do not live only in helper conventions.
