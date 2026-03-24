# Milestone 3 Retrospective: Reflect Mode

Date: 2026-03-23
Status: complete

## Milestone Summary

Milestone 3 delivered the first explicit post-capture thinking mode for `think`:

- a seeded deterministic reflect flow exists in the CLI
- the flow can start from an explicit seed or an interactive recent-capture picker
- reflect sessions produce separate derived entries with preserved lineage
- pressure families now include challenge, constraint, and sharpen
- `--json` and verbose traces cover the reflect plumbing contract
- the acceptance suite is green for the implemented behavior

This is enough to close the milestone.

What changed during implementation is as important as what shipped:

- the original label of “brainstorm” turned out to oversell the deterministic mode
- archive-guessed contrast prompts produced nonsense too often
- not every raw capture should be pressure-tested
- the deterministic mode is best understood as `Reflect`

That is not a failure of the milestone.
It is the milestone doing its job and teaching the product where the real boundary is.

## What We Set Out To Prove

Milestone 3 existed to prove:

- a post-capture mode can help push an idea without corrupting raw capture
- the mode can stay explicit rather than leaking into the capture path
- derived outputs can remain separate and provenance-bearing
- a bounded, inspectable question-led flow can be useful before richer reflection/x-ray work exists

## What Shipped

Implementation:

- reflect / brainstorm CLI surface in [src/cli.js](/Users/james/git/think/src/cli.js)
- reflect session storage and prompt selection in [src/store.js](/Users/james/git/think/src/store.js)

Specification:

- acceptance coverage in [test/acceptance/brainstorm.test.js](/Users/james/git/think/test/acceptance/brainstorm.test.js)

Supporting design work:

- [docs/design/0007-m3-brainstorm-mode.md](/Users/james/git/think/docs/design/0007-m3-brainstorm-mode.md)
- [docs/design/0011-pressure-test-and-spitball.md](/Users/james/git/think/docs/design/0011-pressure-test-and-spitball.md)

Operational behavior:

- preferred user-facing deterministic aliases are:
  - `--reflect`
  - `--reflect-session`
  - `--reflect-mode=challenge|constraint|sharpen`
- older `--brainstorm*` flags still work as compatibility aliases
- reflect refuses low-signal note-like seeds instead of faking depth
- reflect suggestions stay out of plain `--recent`

## What Went Well

- The seeded, explicit entry model held. Reflect never leaked into the sacred capture path.
- Separate derived entries and session lineage held. Raw capture remained untouched.
- The JSON/verbose contract remained useful while the human-facing wording evolved.
- Seed eligibility gating was the right correction. Refusing bad seeds is better than producing fake insight.
- Renaming the deterministic user-facing surface to `Reflect` made the product more honest immediately.

## What Changed During Implementation

The first design for deterministic brainstorm was too ambitious in the wrong place.

Most importantly:

- deterministic contrast selection was not a reliable default
- some raw captures are notes, status updates, or observations, not pressure-testable ideas
- deterministic questioning is good for pressure-testing, but not sufficient for true generative spitballing

That forced four important changes:

1. Brainstorm became seed-first instead of archive-contrast-first
2. Eligibility gating was added so not every raw capture is treated as a candidate
3. Human-facing prompt-family choice was added for better control
4. The shipped deterministic mode was renamed `Reflect`

Those changes improved the product rather than weakening it.

## What We Learned

- Deterministic pressure-testing is useful.
- Deterministic pressure-testing is not the same as true brainstorming.
- The derivation layer is still worth keeping, but as structure and context, not as a stand-in for creativity.
- If an LLM enters the product later, it should be explicit, seed-first, bounded, and clearly separate from the deterministic reflect path.
- “Fail fast and pivot” was the correct posture here. The milestone got better as soon as the team stopped defending the wrong mental model.

## Where We Were Right

- keeping raw capture sacred was right
- storing derived reflect outputs separately was right
- keeping the mode explicit and seeded was right
- keeping JSON plumbing real was right
- treating live usage as a source of truth was right
- preserving derivation while narrowing its job description was right

## What M3 Did Not Try To Solve

These remain outside the closed milestone:

- richer reflection dialogue
- x-ray mode
- archive-structure inspection
- LLM-assisted spitballing
- archive-driven recombine mode as a default path
- embeddings or clustering as product behavior

Those are real future concerns. They are not reasons to reopen M3.

## Risks Carried Forward

- The word “reflect” could be confused with later richer reflection work if the docs are sloppy.
- If future LLM work is added carelessly, it could erase the discipline that made M3 coherent.
- If derivation starts impersonating understanding again, the product could drift back toward fake cleverness.

## Recommendation

Close Milestone 3.

The product outcome is now real:

- `think` has a deliberate post-capture mode
- that mode is explicit, seeded, bounded, and lineage-preserving
- the deterministic surface now has a more honest user-facing name
- the repo has a clearer conceptual split between reflect and future spitballing

The next step is not reopening M3.
The next step is moving toward richer reflection / x-ray work and the higher-leverage “juice” beyond deterministic pressure-testing.

## Next Milestone Readiness

Milestone 4 can begin.

The discipline to keep:

- raw capture remains sacred
- reflect remains explicit and bounded
- richer reflection and x-ray stay separate from capture
- if LLM-assisted spitballing arrives later, it remains explicit and does not quietly replace the reflect backbone
