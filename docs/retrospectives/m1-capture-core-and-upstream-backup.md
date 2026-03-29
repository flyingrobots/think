# Milestone 1 Retrospective: Capture Core And Upstream Backup

Date: 2026-03-22
Status: implementation complete; product-validation follow-through still needed

## Milestone Summary

Milestone 1 delivered the first real `think` capture loop:

- `think "..."` works
- first-run local bootstrap works
- raw text is preserved exactly
- `think recent` is plain and newest-first
- best-effort upstream backup works when configured
- offline or unreachable upstream does not block local success
- default UX avoids Git/WARP terminology
- the Milestone 1 acceptance suite is green

This is enough to say the milestone is wrapped from an implementation and specification standpoint.

It is not enough to say the milestone is fully validated as a product. The roadmap also asked for habit validation and a capture latency budget with a benchmark harness. Those are now follow-through tasks, not blockers to closing the implementation slice.

## What We Set Out To Prove

The milestone existed to prove one narrow thing:

`think` can be a cheap, exact, local-first capture surface without becoming a daemon project, a dashboard, or an ontology engine.

More concretely, we wanted to prove:

- capture can succeed locally without network dependency
- backup can be honest without infecting the user moment
- raw entries can remain boring, exact, and append-only
- tests can encode product doctrine directly

## What Shipped

Implementation:

- CLI entrypoint at [`bin/think.js`](../../bin/think.js)
- local app-home and repo bootstrap in [`src/paths.js`](../../src/paths.js) and [`src/git.js`](../../src/git.js)
- raw capture and plain recent read path in [`src/store.js`](../../src/store.js)
- thin CLI behavior in [`src/cli.js`](../../src/cli.js)

Specification:

- executable acceptance tests in [`test/acceptance/milestone-1.test.js`](../../test/acceptance/milestone-1.test.js)
- reusable temp-home and throwaway Git fixtures under [`test/fixtures`](../../test/fixtures)
- shared assertions under [`test/support/assertions.js`](../../test/support/assertions.js)

Substrate:

- raw captures are stored as Git/WARP nodes with attached exact text content
- upstream replication uses a direct best-effort push of hidden WARP refs

## What Went Well

- Tests really did serve as the spec. The implementation work was straightforward once the acceptance suite was sharp.
- The direct-writer architecture stayed honest. There was no backsliding into a local daemon.
- The user-language contract held. The CLI speaks in product terms, not Git internals.
- `recent` stayed boring. That matters more than it sounds.
- Reusable fixtures paid off immediately. Temp app homes and temp bare remotes kept the suite deterministic without Docker.
- `git-warp` was a good substrate for this shape of product. Raw capture as a node plus attached content was a natural fit.

## What Was Harder Than Expected

- Writer ID encoding needed one adjustment. The design language preferred `mac:<host>:cli`, but `git-warp` writer IDs reject `:`. The product policy survived, but the storage encoding had to become WARP-safe, for example `local.<hostname>.cli`.
- The temptation to add a second storage representation was real. The right answer was to resist it and read back directly from WARP.
- The roadmap language around “Milestone 1 complete” was broader than the implementation slice. It included usage/habit validation and a benchmark harness, which code alone cannot prove.

## What We Learned

- “Tests are the spec” works best when the tests pin user-language constraints, not just mechanics. The Git-term ban was especially valuable.
- The smallest useful implementation was smaller than it first looked. The system needed one writer, one graph, one entry shape, one plain reader, and one best-effort push path.
- WARP complexity can stay below the product surface if the CLI contract is kept ruthlessly narrow.

## Where We Were Right

- Killing `thinkd` as a foundation was the right move.
- Keeping `recent` plain was the right move.
- Separating local success from backup success was the right move.
- Using GitHub-style upstream backup from day one was the right move operationally, even though the actual remote bootstrap flow is still manual outside the codebase.
- Writing reusable test fixtures before implementation was the right move.

## Where The Milestone Is Still Incomplete

These are not reasons to reopen Milestone 1 implementation, but they are real remaining obligations from the roadmap:

- habit validation is still unproven in the wild
- the capture latency budget is defined but not yet enforced with a benchmark harness
- upstream repo provisioning is still an operator step rather than a product flow

The correct interpretation is:

- engineering closure: yes
- product validation closure: not fully yet

## Risks Carried Forward

- If Milestone 2 starts chasing UI polish before real daily use begins, we risk optimizing the wrong capture surface.
- If `recent` gets smarter before reflection mode exists, we will corrupt the mode boundaries we worked to protect.
- If Brainstorm or Reflection work begins before usage proves the capture loop, we will reintroduce speculation too early.

## Recommendation

Close Milestone 1 implementation and proceed.

Before declaring the milestone fully validated as product truth, do two lightweight follow-through steps:

1. Use the CLI enough to learn whether the capture loop is actually habit-friendly.
2. Add a small benchmark harness so the capture latency budget is measured rather than merely stated.

Those should not block Milestone 2 exploration, but they should happen early enough to catch drift.

## Next Milestone Readiness

Milestone 2 can begin.

The discipline to keep:

- menu bar app stays thin
- hotkey and panel reuse the same capture core
- backup state remains silent or minimal
- no dashboard energy
- no retrieval-before-write behavior leaks into the capture surface
