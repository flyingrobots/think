---
id: CORE_boundary-codec-cutover
blocks: []
blocked_by:
  - CORE_hexagonal-store-boundary
---

# Encoding and decoding are mixed into store logic

The Runtime Truth doctrine requires serialization and codec work to stay
at boundaries. Current store code still performs text, JSON, and content
payload encoding directly in domain-adjacent modules.

Examples include `Buffer.from()` in `src/store/content.js`,
`parseJsonArray()` in `src/store/model.js`, JSON-string graph
properties in derivation flows, and content byte decoding in checkpoint
read models.

## Acceptance Criteria

- Introduce named codec ports for text content, graph property payloads,
  and checkpoint content reads.
- Keep `Buffer`, `TextEncoder`, `TextDecoder`, JSON parsing, and future
  CBOR work in adapters or codec modules only.
- Core store workflows receive validated domain objects, not raw decoded
  transport shapes.
- Existing content and checkpoint-read tests pass through the new codec
  ports.
