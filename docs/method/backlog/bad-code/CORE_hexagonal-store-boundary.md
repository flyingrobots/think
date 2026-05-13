---
id: CORE_hexagonal-store-boundary
blocks: []
blocked_by:
  - CORE_runtime-truth-standard-ratchet
---

# Store core imports concrete Node, Git, and WARP adapters

The store layer is currently both domain logic and infrastructure
adapter. Examples include direct imports of `@git-stunts/git-warp`,
`@git-stunts/plumbing`, `node:crypto`, `node:os`, `node:fs/promises`,
and ambient `process` reads inside `src/store/*`.

That violates the Runtime Truth doctrine: core behavior should operate
on injected ports and runtime domain objects, not on concrete host APIs.

## Acceptance Criteria

- Define explicit ports for graph persistence, content storage, clocks,
  random IDs, host metadata, prompt metrics storage, and ambient project
  context.
- Move concrete WARP/Git/Node implementations into adapters or
  composition roots.
- Store workflows accept ports through constructors or named options
  objects.
- Store/domain modules no longer import Node host APIs or
  `@git-stunts/*` concrete adapters directly.
- Add at least one browser-like unit test that runs core store logic
  without Node filesystem, process, or Git globals.
