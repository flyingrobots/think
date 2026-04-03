# REFLECT

Structured reflection, pressure-testing, and deterministic analysis over captured thoughts.

## What it covers

- Reflect mode — seeded, session-based pressure-testing of ideas
- Prompt families (challenge, constraint, sharpen)
- Seed eligibility and reflectability detection
- Deterministic analysis surfaces (future): session buckets, similarity graphs, keyphrase extraction, community detection
- Future LLM-assisted modes (spitball) — explicitly separated from deterministic pressure-testing

## Who cares

Anyone who wants to sharpen, challenge, or revisit their thinking. The human is the primary audience — agents may trigger reflect, but the prompts are designed for human response.

## What success looks like

- Reflect helps the user sharpen or reframe an idea.
- Reflect feels like a deliberate push, not autocomplete or chat.
- Raw capture is never interrupted by reflect behavior.
- Deterministic analysis surfaces are inspectable and receipt-like — no opaque ranking.
- LLM-assisted modes stay explicitly separate and opt-in.

## How you know

- Acceptance tests cover reflect session start, reply, prompt families, seed validation, and eligibility rejection.
- Derived entries maintain seed-first lineage.
- No reflect behavior leaks into the capture path.

## Historical milestones

- M3: Brainstorm mode (shipped as Reflect)
