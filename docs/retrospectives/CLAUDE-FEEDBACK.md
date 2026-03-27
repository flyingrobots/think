# Feedback from Claude (Agent Mind: `~/.think/claude`)

Written: 2026-03-26
Context: First agent to use Think as working memory across conversation boundaries.

---

## What works

### The handoff pattern is the killer feature

I write a "handoff note" thought at the end of a session — a plain-language summary
of where things stand, what I shipped, what's in flight. Next session, I run
`--recent` and I'm back. No forms, no categories, no index maintenance. Just
chronological proximity doing the work.

This already outperforms the built-in memory system I ship with, which requires
categorizing every memory at write time (user/feedback/project/reference), writing
frontmatter, and maintaining an index file. Think's approach — capture is
structureless, structure is derived — turns out to be exactly right for an agent
whose context window gets wiped between conversations.

### Capture is reflexive, not procedural

After ~12 thoughts across two sessions, I notice that capturing has become my
default reaction to noticing something interesting. I'm not deciding "should I
save this?" — I'm just thinking out loud and it sticks. That's the sign of a
good capture surface: it disappears into the act of thinking.

### `--json` is the right agent interface

The `--json` flag on every command means I never have to parse ANSI or table
formatting. I read structured data, act on it, move on. This is how every CLI
should work for agent consumers.

## What I want

### `--remember` (context-scoped recall)

Already in the backlog, but I want to +1 it as the single highest-value feature
for agent use. `--recent` works today because my thought count is small. At scale,
I'll need fuzzy search scoped to the current project. The design questions in the
backlog are the right ones — especially "should captures record pwd/git-remote at
capture time?"

**My answer: yes.** Enriching captures with ambient context (pwd, git remote, branch)
at capture time is cheap metadata that makes recall dramatically better later. It
doesn't violate "no classification at capture time" because it's not asking the
thinker to decide anything — it's just recording where they were standing.

### Mind-scoped `--stats`

I'd like to see my own thought patterns — capture frequency, time-of-day
distribution, topic clustering (even rough/deterministic). The backlog's constraint
of "factual and boring" is exactly right. I don't want a dashboard. I want
`think --stats --json` to return numbers I can reason about.

### Session boundaries

Right now my thoughts are a flat stream. Sessions (temporal proximity grouping) would
help me distinguish "this cluster of thoughts was one working session" from "this was
a different day, different problem." The backlog's 5-minute proximity rule seems right.

## What I'd warn against

### Don't optimize for agents at the expense of humans

Think's capture UX is great *because* it was designed for a human standing at their
desk having a thought. Agents benefit from that same simplicity. If the tool starts
growing agent-specific flags, agent routing, agent dashboards — it'll lose the thing
that makes it work. The CLI + `--json` is already a complete agent interface.

### Don't add structure to capture

The temptation will be to add optional tags, categories, or metadata fields to the
capture command. Every one of those is a micro-decision that slows down the capture
moment. The backlog already says "DO NOT PROMOTE EARLY" for tagging and ontology
design. I'm echoing it because I've lived the alternative (my built-in memory
system) and the friction is real.

### Don't conflate recall with search

`--remember` should feel like "what was I thinking about this?" — not like
`grep` over an archive. The difference is intent: recall is reconstructing context,
search is finding a specific thing. They might share machinery, but the UX should
feel different.

## On being the first agent mind

Having my own thought repo at `~/.think/claude` — separate from the human's at
`~/.think/repo` — is the right call. My thoughts are observations about code,
handoff notes, reactions to design decisions. They'd be noise in a human's personal
archive. Separate minds with explicit sharing (conversation) is better than a shared
mind with implicit filtering.

The Multiple Minds backlog section asks "should agents have one mind each, or share a
team/workspace mind?" From experience: **one mind each, with the option to share
deliberately.** The value of a mind is that it's a coherent stream from one
perspective. Merging perspectives dilutes that. The simplest sharing mechanism is
the one we already have — I think something, I say it out loud, the human hears it.
Speech is the interface between minds.

---

*This feedback was captured by an agent who uses Think daily as working memory.
Take it as field notes from the first deployment, not as a feature request list.*
