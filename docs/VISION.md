# Vision

Generated: 2026-04-03
Source manifest: package.json, CHANGELOG.md, docs/BEARING.md, docs/method/legends/, docs/method/backlog/, docs/retrospectives/, docs/design/ROADMAP.md

This is an artifact-history claim, not a semantic-provenance claim.

---

## What Think is

Think is a local-first tool for capturing raw thoughts the moment they appear — before structure, before categories, before you forget. It stores everything in a private Git-backed repo on your machine, optionally backs up to a remote, and later lets you browse, recall, inspect, and pressure-test what you captured.

Think is designed for a solo developer working with an AI agent. Both sit at the same table. The human captures thoughts through a hotkey, the CLI, or stdin. The agent captures through the CLI or MCP. Both write to the same core. Both read through the same surfaces.

## Where it stands

**Version:** 0.5.0 (fifth milestone release, 2026-04-03)

**Milestones completed:**

| Milestone | What shipped |
|-----------|-------------|
| M0 | Design lock — product frame, architecture, test strategy |
| M1 | Capture core — CLI capture, local repo, upstream backup |
| M2 | macOS surface — menu bar app, global hotkey, transient panel |
| M3 | Reflect — deterministic pressure-testing with prompt families |
| M4 | Reentry — browse TUI, inspect, remember, graph-native reads |
| M5 | Ingress — stdin ingest, URL capture, MCP server, app bundling |

**Codebase:** 30 source files (~9,400 lines), 18 test files, 106 Node.js acceptance tests + 32 Swift tests. ESLint at maximum strictness. CI on GitHub Actions. Tag-triggered release workflow.

**Process:** METHOD with three legends (CORE, SURFACE, REFLECT). 5 up-next items, 22 cool-ideas, 4 graveyard items, 15 historical retrospectives.

## The capture doctrine

The single most important design constraint: **capture must be cheap.**

If it feels like using a system, it's already wrong. The capture path is a trapdoor — type, press Enter, done. No embeddings, no clustering, no tagging, no suggestions, no retrieval-before-write. Raw text in, immutable entry out.

Everything else — browse, remember, inspect, reflect, analysis — comes later and is clearly separated from the capture moment.

## The three legends

**CORE** — The capture path, storage substrate, and graph infrastructure. This is the foundation everything else stands on. Capture must stay sub-second. Raw entries are immutable. Local save never depends on network.

**SURFACE** — All user-facing and agent-facing surfaces. CLI, MCP, macOS app, browse, inspect, recent, remember, stats. The principle: CLI and MCP expose the same semantics — not two products. Every command supports `--json`.

**REFLECT** — Structured reflection and deterministic analysis. Pressure-testing through prompt families (challenge, constraint, sharpen). Future: session buckets, similarity graphs, keyphrase extraction. Reflect is entered deliberately and never ambushes plain capture.

## What's next

The product works. Five milestones are shipped. The immediate priorities are validation and hardening, not new features:

- **Validate the capture habit** — is the hotkey path displacing the CLI for daily Mac capture?
- **Measure capture latency** — benchmark harness for warm-path regression detection
- **Improve upstream provisioning** — reduce manual setup for day-one backup
- **Tune hotkey ergonomics** — configurable global hotkey
- **Track re-entry friction** — learn where the read surfaces fail

The cool-ideas backlog holds 22 items across all three legends. The most structurally interesting are multiple minds (separate thought repos for agents and humans), the remote relay (phone capture through an authenticated bridge), and the deterministic analysis family (session buckets, similarity graphs, community detection — all non-LLM, all receipt-based).

## What it will not become

Think will not become a dashboard, a hosted service, a public sharing platform, or an autonomous narration engine. These are in the graveyard with notes explaining why.

Think will not add intelligence to the capture path. No embeddings before capture habit is proven. No clustering before capture habit is proven. No tagging or ontology that pressures the user during capture.

If a change makes capture slower, smarter, noisier, or more demanding, it is probably the wrong change.

## The long view

Think exists to answer a question: **what happens when raw thought capture is genuinely cheap, local, and replayable?**

The hypothesis is that cheap capture creates a private archive with real value — not because the system understands your thoughts, but because you can return to them honestly. Browse shows context. Remember finds relevance. Reflect applies pressure. Inspect shows receipts.

The system stays honest by keeping the raw layer immutable and the derived layer inspectable. Everything above raw capture — sessions, fingerprints, receipts, analysis — is derived, labeled, and separate. You can always see what is raw and what was computed.

If the hypothesis holds, the interesting future is not smarter capture — it is richer re-entry. Cognitive diffs. Worldline comparison. Abandoned idea detection. Constraint injection. All grounded in honest deterministic analysis, not opaque summarization.

That future is in the backlog. It has not been earned yet.
