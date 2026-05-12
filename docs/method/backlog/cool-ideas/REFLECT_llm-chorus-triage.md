# LLM chorus triage

Human captures a raw idea. Multiple agents react to it from their
own perspectives — challenging, extending, constraining, connecting
to prior thoughts. The human sees a chorus of responses, not one
monolithic LLM answer.

Flow:
1. Human captures a thought into their mind
2. Think fans the thought out to N agent minds (or N prompt families)
3. Each agent produces a derived response in its own mind
4. Human browses the chorus: a view that shows the seed thought
   plus all agent responses side by side
5. Human picks what's useful, discards the rest

This is different from reflect (which is one deterministic prompt
family) and spitball (which is one LLM session). Chorus is multiple
independent perspectives on the same seed.

Requires: agent-owned minds, shared mind browsing, explicit
derivation provenance linking responses to their seed.

Related: REFLECT_llm-spitball, CORE_agent-owned-minds,
CORE_shared-minds-and-collective-ownership.
