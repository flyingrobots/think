# BACKLOG

Status: living backlog

This file captures deferred ideas that are intentionally not part of the current design lock.

It is not a commitment list. It is a pressure-release valve for good ideas that should not distort the current milestone sequence.

## Backlog Rules

- Nothing here overrides the design doctrine.
- No item here should pull intelligence into the capture moment.
- No item here should be promoted ahead of proving daily capture habit.
- Items may move into roadmap milestones only after design review or playback says they are earned.

## Post-M2 Follow-Through

Milestones 1 and 2 are implemented and closed. The remaining gaps here are validation, instrumentation, and a few focused operational improvements.

These should stay visible without being confused for unfinished milestone implementation work.

### Validate Daily Capture Habit

- Use the hotkey path enough to learn whether it has actually displaced the CLI for normal Mac capture.
- Track whether notable thoughts are being captured immediately rather than “later.”
- Watch for hesitation, self-censorship, or moments where the panel still feels like opening an app instead of dropping into a field.
- Compare capture source mix over time in a way that helps product judgment rather than vanity analytics.

### Measure Capture Latency Honestly

- Add a small benchmark harness for warm-path local capture.
- Add lightweight instrumentation for the macOS capture loop:
  - hotkey to panel visible
  - submit to panel hidden
  - submit to local save complete
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

### Brainstorm Submodes

Possible brainstorm flavors:

- diverge
- refine
- challenge
- recombine

These should only appear if they make brainstorm sharper rather than more menu-driven.

### Dialogue With Receipts

Reflection should feel like a mentor with receipts:

- dialogue-first by default
- explicit x-ray mode when the user wants the machinery

This is already part of the design doctrine, but the exact interaction design remains backlog material.

### Reflection As Data

Treat reflection responses as first-class entries rather than disposable chat.

This is partly reflected in the current docs, but richer handling of meta-entries belongs here until the core capture loop is proven.

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
