# LLM-assisted spitball mode

If Think later uses an LLM for idea generation, it should not silently replace deterministic pressure-testing.

Keep the split explicit:

- Pressure-test for deterministic challenge / constraint / sharpening.
- Spitball for bounded, seed-first, LLM-assisted idea branching.

Constraints:

- Explicit entry only.
- No ambient model suggestions after capture.
- No archive-wide opaque retrieval by default.
- Derived outputs stay separate from raw capture.
- Context supplied to the model should be inspectable and receipt-like.
