---
id: CORE_runtime-domain-model-cutover
blocks: []
blocked_by:
  - CORE_hexagonal-store-boundary
---

# Important runtime contracts still move as plain object shapes

Think has good class-backed anchors such as `Entry`,
`ReflectSession`, `CaptureProvenance`, domain errors, runtime read
entries, and MCP outcomes. The broader store/read/MCP workflows still
move many implicit plain-object contracts between layers.

Runtime Truth requires important concepts to be constructor-validated
runtime models, not informal shape conventions.

## Acceptance Criteria

- Promote graph model status, capture results, remember scopes, browse
  windows, migration outcomes, prompt metric summaries, and repair
  outcomes into runtime-backed classes or equivalent Swift value types.
- Replace generic `throw new Error(...)` in source with domain-specific
  error classes.
- Boundary DTOs remain plain only at adapters and wire schemas.
- Tests assert `instanceof` or equivalent runtime identity for important
  outcomes inside one realm.
- Cross-realm values normalize at boundaries before entering core.
