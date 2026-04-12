# RE-025 — Deferred Derivation Pipeline

Legend: [RE — Runtime Engine](../../legends/RE-runtime-engine.md)

## Idea

The current `finalizeCapturedThought` phase runs synchronously after the raw capture is saved. This phase performs derivation (quality scoring, attribution) and graph-edge creation. As the WARP graph grows, the latency of this phase could eventually exceed the sub-second "trapdoor" target for capture.

Refactor the capture flow to decouple these concerns. Return the `entryId` to the user/agent immediately after the raw capture is successfully written to the local repo. Move the derivation and migration follow-through to a background process or an unblocked microtask tick.

## Why

1. **Sacred Capture**: Guarantees that the capture path remains sub-second regardless of graph size or derivation complexity.
2. **Reliability**: A failure in the derivation pipeline should not prevent the raw thought from being successfully recorded.
3. **Efficiency**: Moves heavy interpretive work to "idle" time, keeping the ingress surfaces responsive.

## Effort

Medium — requires refactoring the `saveRawCapture` / `finalize` orchestration and ensuring the derivation worker handles partial failures gracefully.
