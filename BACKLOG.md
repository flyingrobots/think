# BACKLOG

Status: living backlog

This file captures deferred ideas that are intentionally not part of the current design lock.

It is not a commitment list. It is a pressure-release valve for good ideas that should not distort the current milestone sequence.

## Backlog Rules

- Nothing here overrides the design doctrine.
- No item here should pull intelligence into the capture moment.
- No item here should be promoted ahead of proving daily capture habit.
- Items may move into roadmap milestones only after design review or playback says they are earned.

## Operational Follow-Through Before Or Alongside M4

Milestones 1, 2, and 3 are implemented and closed. The remaining gaps here are validation, instrumentation, and a few focused operational improvements.

These should stay visible without being confused for unfinished milestone implementation work.

### Validate Daily Capture Habit

- Use the hotkey path enough to learn whether it has actually displaced the CLI for normal Mac capture.
- Track whether notable thoughts are being captured immediately rather than “later.”
- Watch for hesitation, self-censorship, or moments where the panel still feels like opening an app instead of dropping into a field.
- Compare capture source mix over time in a way that helps product judgment rather than vanity analytics.

### Measure Capture Latency Honestly

- Add a small benchmark harness for warm-path local capture.
- Keep the macOS prompt telemetry factual and boring:
  - hotkey to panel visible
  - time spent typing
  - abandoned-empty vs abandoned-started vs submitted
  - submit to panel hidden
  - submit to local save complete
- Add a simple read/report surface over the prompt telemetry so the data can actually inform product judgment.
- Decide later whether any latency aggregates belong in `think --stats`; if they do, keep them factual and boring.
- Keep this as measurement and regression detection, not a flaky timing assertion in the deterministic suite.

### Tune Hotkey Ergonomics

- Allow the macOS app to override the default global hotkey while keeping a sane built-in default.
- Keep preference plumbing lightweight; do not add a settings window until it is clearly earned.
- If configuration is added, include basic validation and collision awareness.

### Improve Upstream Provisioning

- Make day-one upstream setup more operator-friendly.
- Reduce the amount of manual repo/bootstrap work needed to get private backup running.
- Keep this boring and explicit; do not turn it into hosted-service scope creep.

### Tidy Backlog Routing

- Keep follow-through tasks distinct from milestone deliverables so `M4` does not inherit stale `M1`/`M2` wording.
- When a deferred item is clearly shaping `M4` or later, call that out rather than leaving it as an orphaned idea.

## Deferred From Design Review

These came directly out of the design review and should stay visible.

### SHOULD

- Track re-entry friction explicitly during playbacks.
- Add a lightweight way to mark an entry as interesting during reflection, not during capture.
- Keep CLI and the macOS capture surface first-class even as other ingress surfaces appear.

### COULD

- Add session IDs for brainstorm and reflection threads.
- Add carefully designed revisit prompts such as “revisit this in N days” after habit is proven.
- Add cross-device capture once local capture and backup are clearly habitual.

### DO NOT PROMOTE EARLY

- Embeddings before capture habit is proven.
- Clustering before capture habit is proven.
- Dashboard-first UX.
- Tagging, ontology design, or anything that pressures the user to classify thoughts during capture.

## Cool Ideas From Review

These are aligned but intentionally deferred.

### Cognitive Diff View

Show how language about an idea changed over time.

Constraints:

- use actual entry-to-entry wording changes where honest
- avoid collapsing the history into a summary too early

### Trigger Analysis

Surface patterns in what tends to cause useful idea shifts.

Possible future prompts:

- “Your best shifts often follow constraint.”
- “You tend to reframe after explaining something to someone else.”

### Abandoned Idea Detector

Find ideas revisited several times without clear resolution and invite deliberate re-entry.

Possible future prompt:

- “You keep circling this. Want to push it?”

### Constraint Injection Mode

In brainstorm mode, inject a deliberate constraint to sharpen thinking.

Examples:

- “What if you had 10 minutes to implement this?”
- “What if this had to work offline?”
- “What if this had to be explainable in one sentence?”

### Future Self Prompts

Resurface older thoughts and ask whether they still feel true.

Example:

- “You said this two weeks ago. Still true?”

### Browse Session Presentation

The first session drawer and session traversal are useful, but the human playback surfaced follow-through improvements worth keeping visible.

Possible future directions:

- show sessions as a clearer list, tree, timeline, or stepper rather than a plain flat block of entries
- show a visible session timestamp or session-start label
- make session navigation feel more structured without replacing the current thought as the primary surface

Important constraint:

- keep browse reader-first; session presentation should support the current thought, not become a second homepage

### Browse Visual Hierarchy And Short IDs

The current browse metadata works, but it is still visually noisy in places.

Possible future directions:

- shorten visible entry ids in browse the way Git shortens hashes
- use color or hierarchy to break up metadata more clearly
- explore table-like metadata layout where that improves legibility

Important constraint:

- the inspect surface should still be able to reveal the full exact ids when needed

### Session Summary And Per-Session Stats

Session context may later earn a lightweight summary layer.

Possible future directions:

- session summary
- thoughts per session
- per-session stats
- context-switch count

Important constraint:

- keep these factual and inspectable rather than turning them into dashboard theater or recommendation sludge

### Menu Bar Daily Report

Expose a lightweight daily report from the macOS menu bar app, likely by opening a local web view with charts over prompt telemetry and recent usage.

Constraints:

- treat this as a read surface, not a control panel
- favor honest benchmark and usage views over vanity analytics
- keep it clearly separate from the capture moment

### Golden Transcript Test

Keep a canonical end-to-end “thinking trace” fixture:

- capture `A`
- capture `B`
- capture `C`
- verify replay order and exact content

This is less a product feature than a high-value regression artifact.

### Stress Capture Test

Simulate a burst of rapid captures and verify:

- all captures succeed
- no silent corruption appears
- ordering remains coherent

This should stay out of the deterministic acceptance suite unless it can remain stable, but it is worth preserving as a future reliability check.

### Offline-First Torture Test

Exercise a harsher durability path:

- capture with unreachable upstream
- interrupt or restart the process
- verify local entries still exist afterward

This is a good future confidence test for the local-first durability claim.

## Deferred Ideas From The Earlier Product Exploration

These came out of the earlier product-shaping conversation and are worth preserving without promoting yet.

### Multiple Minds

Break the assumption that the thought store is always a single repo at `~/.think/repo`.

Possible future shape:

- support multiple named minds backed by separate thought repos
- allow an explicit active/default mind for normal capture
- make it possible for a human operator and one or more agents to have distinct minds
- allow deliberate shared minds later without making accidental cross-contamination easy

Important constraints:

- do not make warm-path capture depend on choosing among many minds every time
- do not let an agent silently write into the human's default mind unless that is explicitly intended
- keep provenance explicit about which mind/repo an entry belongs to
- keep the current config-driven repo path as a low-level escape hatch, not the full multi-mind UX

### Holding Area And Mind Routing

If `think` later supports multiple minds, raw ingress may need a neutral local holding area before later derivation or routing assigns a thought to a more specific mind.

Possible future shape:

- capture into a local holding area first
- run derivation/context assignment later
- route or copy into a target mind only once the assignment is explicit

Important constraints:

- raw capture must still remain cheap and immediate
- delayed routing must not create ambiguity about where the authoritative raw event lives
- mind routing should not silently replace explicit targeting when the user or agent already knows the correct destination

### Agent-Owned Minds

If `think` becomes agent-native, an agent may need its own thought repo rather than writing into the operator's personal mind.

Why this matters:

- it preserves separate provenance
- it avoids polluting a human's private archive with machine-originated thought
- it makes replayable agent memory possible even if the agent itself does not retain direct conversational memory

Possible future questions:

- should agents have one mind each, or share a team/workspace mind?
- what does controlled sharing or handoff between minds look like?
- how explicit should the human be about whether a session writes to a human mind, agent mind, or shared mind?

### Cryptographic Protection

If multiple minds or sensitive private archives exist, the storage and backup model will probably need stronger cryptographic protection than plain local Git plus private remote.

Possible future shape:

- per-mind encryption or key-wrapping
- encrypted backup to remote
- explicit unlock model for local and agent access
- boring, auditable key custody

Important constraint:

- do not add crypto in a way that breaks the cheap, habitual capture path unless the unlock model is already solved cleanly

### Provenance Sovereignty And Privacy Boundaries

If `think` becomes a substrate for human and agent memory, its stored traces may become closer to autobiographical provenance than ordinary app telemetry.

Important future questions:

- when should a mind be treated as protected interior trace rather than routine infrastructure?
- what should default opacity or sealing look like for sensitive minds?
- how should replay, export, and inspection be capability-scoped and audited?
- what would it mean to reclassify older traces as more sensitive after a system accumulates persistent identity or autobiographical memory?

Design implications to preserve:

- minimum-necessary introspective capture should beat capture-everything defaults
- sensitive traces may need retroactive sealing or treatment as toxic assets
- replay and inspection should eventually become attributable, scoped operations rather than ambient access

### Shared Minds And Collective Ownership

If `think` later supports shared minds, the storage model may need to represent jointly produced and jointly owned provenance rather than assuming one subject per repo.

Possible future shape:

- shared minds with explicit group ownership
- group-held keys or threshold access for sensitive shared traces
- explicit handoff, partition, or arbitration rules when a shared mind forks or splits

Important constraint:

- do not collapse shared cognition into a single implicit owner when provenance or obligations are actually collective

### Brainstorm Submodes

Possible brainstorm flavors:

- diverge
- refine
- challenge
- recombine

These should only appear if they make brainstorm sharper rather than more menu-driven.

### LLM-Assisted Spitball Mode

If `think` later uses an LLM for idea generation, it should not silently replace deterministic pressure-testing.

Keep the split explicit:

- pressure-test for deterministic challenge / constraint / sharpening
- spitball for bounded, seed-first, LLM-assisted idea branching

Important constraints:

- explicit entry only
- no ambient model suggestions after capture
- no archive-wide opaque retrieval by default
- derived outputs stay separate from raw capture
- context supplied to the model should be inspectable and receipt-like

### Dialogue With Receipts

Reflection should feel like a mentor with receipts:

- dialogue-first by default
- explicit x-ray mode when the user wants the machinery

This is already part of the design doctrine, but the exact interaction design remains backlog material.

### Reflection As Data

Treat reflection responses as first-class entries rather than disposable chat.

This is partly reflected in the current docs, but richer handling of meta-entries belongs here until the core capture loop is proven.

## Deferred Deterministic Analysis Ideas

These are strong non-LLM ideas, but they do not belong in `M3` brainstorm mode. They are better treated as later reflection / x-ray machinery.

### Session Buckets

Group captures by temporal proximity to create honest “human session” structure.

Possible rule:

- same session if captured within 5 minutes

Good uses later:

- reflection packs
- replay artifacts
- cluster disambiguation
- brainstorm candidate selection

### Multi-Signal Similarity Graph

Build a deterministic graph using more than lexical overlap alone.

Possible edge inputs:

- TF-IDF or BM25-style lexical similarity
- temporal session proximity
- later, explicit brainstorm or reflection linkage

The important rule:

- do not claim this is “meaning”
- present it as structural nearness with receipts

### Community Detection

Run Louvain or Leiden-style community detection over the later similarity graph.

Possible uses:

- x-ray neighborhoods
- reflection packs
- cluster-level replay

Constraints:

- keep the cluster explanation inspectable
- never silently inject cluster meaning into capture or recent

### Keyphrase Receipts

Use deterministic keyphrase extraction such as TextRank to surface reflective handles.

Good use:

- weekly or cluster-level reflection receipts

Bad use:

- pretending to summarize the user’s mind for them

The system should say:

- “here are the statistical handles”

not:

- “here is what your week meant”

### Cluster-Aware Novelty And Stability Metrics

Track how an inferred thread changes over time without pretending adjacent edit distance is idea evolution.

Better signals than raw Levenshtein drift:

- keyword turnover
- novelty of high-weight terms
- re-entry cadence
- distance from cluster centroid
- activity over time

### Structural Receipts

Whenever later modes expose a cluster or link, show why it exists.

Examples:

- shared unusual terms
- same session bucket
- explicit brainstorm linkage

This should stay explainable and deterministic.

### Do Not Promote Early

- raw adjacent-entry Levenshtein drift as the main evolution metric
- lexical-only clustering presented as “understanding”
- silent classification leaking into capture or recent

## Additional Cool Ideas To Track

These are my additions. They fit the doctrine, but they are deferred on purpose.

### Capture Latency Ledger

Track timing data around the capture loop so regressions stop hiding inside “feels fast enough.”

Potential dimensions:

- hotkey to panel visible
- panel visible to first keystroke
- submit to panel hidden
- submit to local save complete

Constraints:

- no noisy telemetry UI in the capture path
- no dashboard drift
- use the data to sharpen product judgment, not to gamify usage

### Optional Capture Sounds

Add a very small optional sound layer for trust-building:

- subtle success cue
- subtle failure cue

Constraints:

- must not slow the capture path
- must not become naggy or theatrical
- should remain optional if it ever ships

### Capture Recovery Queue

If upstream backup fails, keep a visible but quiet backlog of pending backups that can flush later without bothering the user during capture.

Important:

- no admin-console UX
- no network dependency for local success

### Replay Session Artifacts

Allow a future reflective session to generate a compact replay artifact showing:

- the seed entries considered
- the questions asked
- the user’s responses
- the resulting meta-entry or conclusion

This could become useful for “how did I get here?” moments.

### Reflection Packs

Generate a future “reflection pack” around a cluster or theme:

- a few raw entries
- a few unresolved tensions
- one or two sharp questions

This is a good candidate for later dialogue mode once enough real data exists.

### Worldline Comparison

Compare two inferred idea trajectories and ask:

- “Are these actually the same evolving idea?”
- “Did this fork, or did your framing just sharpen?”

This belongs far later, after the product has enough entries to make the comparison honest.

### Source Pattern Analysis

Look for differences by ingress source:

- CLI vs menu bar
- capture vs brainstorm vs reflection

Only useful later, once there is enough volume and only if it improves product understanding rather than adding vanity analytics.

### Hotkey Recorder

If configurable hotkeys ship, use a focused recorder flow instead of a settings-heavy surface.

Constraints:

- one narrow responsibility
- basic collision detection
- no preference sprawl
- no panel clutter

### Writer Provenance Views

Later, expose provenance by ingress surface in a way that is useful rather than substrate-heavy.

Examples:

- “Captured from menu bar”
- “Captured from CLI”
- “Explored during brainstorm”

This should only show up once it helps reflective understanding and does not drag Git/WARP concepts into normal UX.

### Quiet Backup Flushes

The current backup contract is honest but minimal. Later, it may be useful to add a quiet background flush path for pending backups:

- no nagging
- no control-panel UX
- no impact on local capture success

This is related to the earlier capture recovery queue idea, but narrower and more operationally grounded.

## Parking Lot

Ideas that sound exciting but should remain parked until the product earns them:

- hosted collaborative thinking
- public sharing
- heavy analytics dashboards
- autonomous reflection narration
- proactive AI interruptions during capture
