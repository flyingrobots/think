# Raise SSJR grades for `src/cli/graph-gate.js`

Current SSJR sanity check: `Hex B`, `P1 B`, `P2 B`, `P3 B`, `P4 B`, `P6 B`, `P7 B`.

The graph gate has the right responsibility, but its migration decisions and outcomes are still plain-object and string-driven. Move toward a named gate/policy result that owns the branching semantics.
