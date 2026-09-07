---
title: Think Testing Standards
status: Accepted
binding: true
created: 2026-09-07
updated: 2026-09-07
scope: Every automated assertion in Think, including harnesses and benchmarks
---

# Think Testing Standards

Think promises cheap capture, durable raw thoughts, and honest re-entry. Tests
must provide evidence for those promises. The suite must resist three failures:
false confidence, false alarms, and decay in cost or usefulness.

This standard complements the mandatory [Runtime Truth Infrastructure
Doctrine](INFRASTRUCTURE_DOCTRINE.md). Runtime observations establish what the
program does; independently stated contracts establish what it must do. A green
suite does not overrule a reproduced failure. An implementation's current output
does not automatically become the expected behavior.

## Adoption and enforcement

The rules apply immediately to new and materially changed tests and to evidence
for the behavior a change claims. Existing violations are debt, not precedent.
Improve relevant tests as they are touched; do not rewrite the suite as a
prerequisite to unrelated work or add assertions merely to test a documentation
edit. Existing architecture ratchets and required checks remain in force.

Review enforces the evidence requirements today. Repository-wide resource
sandboxing, size metadata validation, suite latency budgets, quarantine/XFAIL
ledgers, continuous fuzzing, and automated calibration are **not claimed to be
implemented by this document**. Their rollout is tracked in
[CORE_testing-standard-enforcement](method/backlog/bad-code/CORE_testing-standard-enforcement.md).
Do not describe a planned check as an active CI gate.

An exception records the affected claim, reason, evidence attempted, remaining
risk, named owner, backlog/issue link, approving maintainer, and review date.
The review date is at most 30 days away unless the maintainer explicitly records
why a longer interval is appropriate. Expiry requires a new disposition; it
never silently grants permission or deletes coverage. A writing agent cannot
approve its own waiver. Existing release and production-data permissions apply.

## Current commands and boundaries

[package.json](../package.json) and [CI](../.github/workflows/ci.yml) are the
executable command definitions. Update this table when they change.

| Command | Current work | When to run |
| --- | --- | --- |
| `npm run test:fast` | Lint, both architecture/runtime ratchets, then `test:ports` | Required local check after edits; default pre-push hook |
| `npm run test:ports` | Node tests in `test/ports/*.test.js` | Changed product/module/adapter contracts |
| `npm run test:m1` | Node CLI acceptance tests in `test/acceptance/*.test.js` | CLI behavior and integration changes; part of CI |
| `npm test` | Ports followed by acceptance | Node integration validation; CI also runs lint separately |
| `npm run test:m2` | `swift test --package-path macos` | Affected macOS behavior on a compatible host |
| `npm run test:local` | Ports, acceptance, and Swift | Relevant full local matrix; does not itself run lint |
| `npm run test:benchmarks` | Tests of benchmark reports/harnesses | Benchmark implementation changes; separate from `npm test` |
| `npm run benchmark:capture -- --json` | Capture measurements | Capture performance experiments |
| `npm run benchmark:browse -- --json` | Browse measurements | Browse performance experiments |

CI currently runs Node 22 on Ubuntu and exposes the stable `ci` check. Swift,
benchmark harness tests, and sustained performance campaigns are not in that
workflow. A passing `test:fast` does not establish their results.

`test/ports` names scope, not resource size: it includes real Git repositories
and subprocesses. The existing [CLI fixture](../test/fixtures/think.js) and
[environment fixture](../test/fixtures/runtime.js) provide a temporary home and
scrub inherited Think/Git repository selectors. They are useful starting points,
not evidence that every test is hermetic. The [temporary-directory helper](../test/fixtures/tmp.js)
creates scratch space; callers must arrange cleanup.

## The rules

### 1. Test the narrowest owned contract

Use the module, product port, codec, CLI, MCP, or macOS boundary that owns the
promise. A useful internal module can have its own contract without becoming a
public package API. Helpers are normally exercised through their owning module;
do not create accessors or export internals solely to satisfy a test.

Think application tests speak in captures, entries, reads, and outcomes.
Substrate refs, object layout, runtime classes, and recovery mechanics belong in
adapter, repair, or benchmark tests, as required by the infrastructure doctrine.
Keep real consumer tests at the surface where integration is the risk.

**Prevents:** refactoring deadlock, accidental API commitments, and relying on
only a few expensive end-to-end tests.

### 2. Observe outcomes and make absence explicit

Assert returned values, exact captured content, durable reads after reopen,
structured errors, emitted records, released resources, or absence of forbidden
effects. A successful process exit alone does not show that a thought survived.
Assert ordering, IDs, timestamps, and byte identity only where contractual.

For universal checks, inspect every relevant output and report the witness count;
assert required records separately. Zero matches must fail when presence is
required. Validate the output schema before harvesting; a name regex alone
cannot prove that arbitrary fields contain no secrets. Empty output is valid
only when the contract says so.

Use real implementations when cheap and controlled. A fake used as a substitute
for an adapter must share a conformance suite with it, or carry a documented
drift-risk exception. Interaction assertions are appropriate when the interaction
is itself the contract: a backup publication, a refusal to write, or an explicitly
budgeted number of Git operations. Avoid pinning collaborator choreography.

**Prevents:** vacuous collection checks, missed effects, and fakes that manufacture green results.

### 3. Organize by behavior and declare the change kind

Every PR declares one or more of the following kinds, with scope when mixed.

| Kind | Expected test evidence |
| --- | --- |
| Refactor / optimization | Preserve semantic expectations; use equivalence evidence appropriate to risk |
| New feature | Add tests for the new promise; preserve unrelated expectations |
| Bug fix | Add or strengthen regression coverage and show the intended failure on unfixed code |
| Deliberate behavior change | Update affected expectations and explain the contract change |

Documentation, build, and test-maintenance changes may declare that classification
with a reason; do not invent a product behavior change. Moving tests, changing
imports/harness setup, correcting a wrong oracle, and replacing brittle tests are
allowed during a refactor when the PR explains why expectations remain valid or
which test defect is being corrected.

One test establishes one coherent behavior, potentially with several assertions
or a short protocol exchange. Names describe that behavior and case parameters.
The word "and" is not a lint failure. Large unrelated scenarios should be split.

**Prevents:** method-shaped suites, hidden contract changes, and oversized scenarios.

### 4. Calibrate every new or changed load-bearing claim

Show that each assertion carrying a new or materially changed claim detects a
representative violation. A witnessed regression on unfixed code, a targeted
mutation, or a controlled fault can supply that evidence. Group related checks
when one experiment visibly exercises their claim; a failing earlier assertion
does not calibrate later assertions that never ran.

Record the command, revision or patch, expected failing test/check, actual failure,
and restored green run. Syntax errors, import failures, unrelated timeouts, and
an absent test are not successful calibration. Await asynchronous assertions.
Invalidate affected build caches when applying and reverting a mutation. Use an
isolated worktree or fixture; never mutate a real mind to demonstrate failure.

Apply continuous mutation selectively to risky changed behavior, triage equivalent
mutants and survivors, and never gate on a mutation percentage. The requirement
is evidence for claims, not one mutant per syntactic assertion or more tests for
their own sake.

**Prevents:** assertions that cannot detect the defect they claim to protect against.

### 5. Use generated evidence for broad equivalence claims

For storage refactors, alternate read paths, codec transformations, or "nothing
changed" over a meaningful input space, compare generated cases against a pinned
reference or assert independent properties/metamorphic relations. Keep readable
examples for specified edge cases. A small mechanical change may justify existing
contract tests instead; state the boundary of the evidence.

Finite exploration is evidence, not proof for all inputs. Record corpus categories
so many empty or duplicate inputs cannot impersonate breadth. Log randomized seeds
before launching the test process; retain revision, dependency versions, generator
configuration, and a replay command. Use shrinking when supported; otherwise reduce
the counterexample manually and document that limit. Commit minimized, sanitized
regressions and replay them in ordinary CI. Scheduled fresh seeds extend exploration;
fixed seeds and retained cases keep presubmit failures reproducible.

Differential agreement can preserve shared bugs. Retire or scope the old oracle
when intentionally changing behavior; do not make unwanted behavior permanent.

**Prevents:** unsupported equivalence claims, lost reproducers, and bug-for-bug lock-in.

### 6. Name the oracle

Expected results come from a stated requirement, independently worked vector or
reference model, invariant/relation, alternate implementation, or reviewed
characterization artifact. Make that source evident in the test; add a one-line
oracle note when it is not obvious. Each distinct claim needs an identifiable
source, not necessarily a separate metadata field on every assertion.

Do not use production normalization to compute both expected and actual values.
A small independent model often supplies a clearer oracle. These categories are
not an absolute ranking: specifications can be wrong, and a golden authored from
a wire specification is stronger than a recording of today's output. Label the
latter as characterization and apply rule 17.

**Prevents:** tautologies and unexplained snapshot changes presented as correctness.

### 7. Construct determinism at the seams

Inject time, randomness, identity, scheduling, and host capabilities when behavior
depends on them. Pin logical time for timestamp assertions and use monotonic time
for durations. Control locale, timezone, Git identity/configuration, and repository
selection when observed. Never use a bare sleep to coordinate concurrent work.

Real process, filesystem, and timer integration tests may observe the OS. Bound
their execution, record the relevant environment, and state the nondeterminism
remaining. Generated temporary names can provide isolation without becoming
expected output; canonicalize their incidental representation. Do not add a seam
for a capability the tested behavior never observes.

**Prevents:** clock-dependent results and irreproducible environmental failures.

### 8. Own everything a test can affect

Use fresh scratch state, clean it up even on failure, close handles/processes, and
partition mutable resources between parallel tests. Shared immutable vectors or
infrastructure with verified per-test reset are acceptable. Bind servers to port 0;
use local bare repositories for backup tests. Required tests must not depend on
ambient internet, credentials, developer Git configuration, or existing minds.

Never run an automated capture, repair, migration, or benchmark against an
operator's real mind. Use the checked-out CLI with explicit fixture environment,
not an installed agent wrapper. Production-data rehearsals require separately
authorized copies, privacy controls, and before/after source evidence. Keep private
thoughts out of committed fixtures and public failure logs.

**Prevents:** cross-test contamination and damage to the data Think exists to preserve.

### 9. Classify resources and budget feedback

Size describes resources independently of test directory or product scope.

| Size | Allowed test workload, excluding runner/module loading | Initial per-test timeout ceiling |
| --- | --- | ---: |
| Small | One process; in-memory collaborators; no external I/O, subprocesses, threads, or sleeps | 1 second |
| Medium | One machine; owned files, Git/processes, or loopback services | 60 seconds |
| Large | Multi-machine, live external integration, or a campaign beyond medium's envelope | 15 minutes |

These are starting ceilings for **new declarations**, not measured current suite
budgets or product SLOs. Declare size and timeout at test/group level; files mixing
sizes must distinguish their groups. Until metadata tooling lands, use a nearby
comment and the runner's timeout option. Stateful workloads need an outer process
deadline and child cleanup where a runner timeout cannot interrupt them.

Long fault/performance campaigns need an explicit owner and job budget. Do not
relabel a slow test to evade investigation. Measure suite p50/p95 and flake rates on
a named worker class, then establish reviewed suite budgets and enforce resource
ceilings in the harness. That enforcement is tracked debt, not an existing feature.

**Prevents:** unbounded hangs, misleading "fast" labels, and unaffordable feedback loops.

### 10. Preserve failures; quarantine deliberately

A changed test result on the same revision is evidence to investigate, including
possible product races. Preserve the first failure. Repeated, shuffled, or parallel
runs are diagnostic tools chosen for isolation risk; retries never erase a failed
gate or establish that the cause was fixed.

Triage a confirmed flake the same working day. Remove only the smallest unreliable
check from a gate through a reviewed quarantine with a named owner, issue, separate
visible execution, and fix/review date within 14 days. If that loses the only check
on a critical promise, retain a trusted replacement or obtain an explicit risk
decision before weakening the gate. Expiry escalates to fix, replacement, or a
reviewed extension; it does not automatically delete the test or close the bug.

**Prevents:** retry-to-green culture and quarantines that conceal real data-loss risks.

### 11. Use coverage to inspect missing evidence

Coverage reveals code not exercised; it cannot establish the quality of an oracle.
Use changed-line and periodic subsystem reports to identify risks. Do not introduce
repository-wide coverage or mutation percentages as a proxy for correctness.
An explicit component completeness requirement may be justified by its risk model.
Any existing gate must be changed through its own reviewed decision; adopting this
document does not disable checks in Think or its dependencies.

**Prevents:** assertion-free tests written to improve a score and accidental gate removal.

### 12. Observe bug regressions on the unfixed code

For a bug fix, run the boundary regression against the unfixed revision and observe
the intended failure. Separate test/fix commits or a recorded parent-revision run
are both acceptable. A test authored after the fix can be run against that earlier
code; claiming it "would have failed" is insufficient. Reuse suitable coverage
rather than duplicate a test just to make the count increase.

Preserve the reported case and explore its failure family where useful. If the
failure cannot be reproduced, record attempts, add diagnostics/invariant checks,
expand targeted exploration, and obtain an explicit exception. Keep the unresolved
mechanism/test gap tracked. A later green CI run is not a causal explanation.

**Prevents:** recurring bugs and fixes supported only by counterfactual testimony.

### 13. Fuzz input boundaries and property-test transformations

Prioritize Think's ingress, import/export, persisted-record decoders, and other
trust-boundary parsers. Exercise malformed/truncated records, Unicode, size limits,
and ambiguous shapes. Assert meaningful rejection or round-trip semantics as well
as no crash, hang, or corruption. Use sanitizers where the language/runtime permits.

Keep targets buildable, corpora minimized and sanitized, and historical failures
in CI. Long coverage-guided campaigns belong in scheduled jobs with bounded cost;
an unrun target is not continuous fuzzing. Add properties for normalization,
encoding, projection construction, and other transformations according to risk.

**Prevents:** silent decoder errors, untested hostile input, and abandoned fuzz scaffolding.

### 14. Explore concurrency with reproducible schedules

At controllable ports, use barriers, deterministic executors, explicit operation
order, or a seeded scheduler to exercise competing writers, cancellation, and
handle closure. Record safety and liveness separately: no lost acknowledged
capture and eventual completion under stated healthy conditions are distinct claims.

Keep real multi-process/OS tests for locks and integration. Stress and race
detectors supplement controlled exploration; neither proves schedule coverage or
correctness. Record a failing schedule/seed when available, plus operation IDs,
pending stages, and bounded wait diagnostics for real execution. State exploration
bounds and unsupported faults instead of claiming exhaustiveness.

**Prevents:** concurrency evidence consisting solely of a workload that usually finishes.

### 15. Inject failures into durability and recovery paths

For each changed durability promise, cross faults with operation phases: admission,
durable publication, acknowledgement, derived followthrough, reopen, and recovery.
Inject relevant I/O failure, interrupted process, timeout/cancellation, unavailable
backup, and faults during recovery. A deterministic failure index or recorded
schedule is a valid reproducer; randomized injection additionally needs its seed.

After each relevant fault, verify the declared atomicity/visibility outcome, raw
content integrity, and recovery behavior. Reopen through supported product/adapter
contracts. Never assume a mocked write error establishes power-loss durability;
state what the substrate guarantees and test the Think integration that relies on
it. Preserve authoritative input and validate output before any migration cutover.

**Prevents:** unexercised recovery promises and tests that confuse local save with backup.

### 16. Treat performance as an experiment

State the hypothesis and compare pinned before/after revisions on the same machine
and workload. Control or alternate/randomize order; distinguish cold CLI startup,
warm capture, followthrough, reads, and reopen. Record runtime/Git/dependency
versions, corpus size and payload distribution, maintenance/cache state, process
counts, object/byte growth, memory, and semantic output checks where relevant.

Retain raw samples and report p50, p95, and max; add p90/p99 when sample counts and
the workload support meaningful tail estimates. A few smoke samples cannot
establish p99. Shared CI comparisons need a same-run baseline and a tolerance
wider than measured noise. Validate that the harness detects a deliberate slowdown;
account for coordinated omission when measuring queued/concurrent arrivals.

Think's sub-second capture objective remains an absolute product target. A relative
improvement and meeting that target are separate results. Existing benchmark
report tests check the instrument's interface; they do not establish performance
acceptance. Controlled release experiments and coarse CI smoke signals must be
labeled accordingly. Preserve existing assertions while improving measurement.

**Prevents:** optimization decisions based on noise and fast results that changed semantics.

### 17. Review baselines and known failures

Minimize snapshots/goldens to the contract, canonicalize only incidental variation,
and identify whether expected bytes come from a specification or characterization.
Do not strip meaningful ordering, provenance, or captured content to make a diff
green. Regenerated output requires review with the associated behavior change;
large updates need an explicit common cause and a reviewable decomposition.

Known deterministic failures may use an XFAIL mechanism only when it detects an
unexpected pass as failure, identifies the expected failure precisely, and has an
owner, issue, and expiry. Broadly swallowing exceptions is not XFAIL. Quarantine
handles untrusted verdicts; XFAIL tracks trusted evidence of an unfixed bug.
Until suitable reporting exists, use an explicitly reported non-gating lane with
an owned issue; a silent skip is not equivalent protection.

**Prevents:** unread re-baselines and known failures disappearing into comments or skips.

### 18. Maintain test code and retire it with reasons

Prefer obvious setup/action/assertion flow, named cases, useful diffs, and local
builders over clever shared state. Loops are appropriate for generated cases,
state-machine histories, and fault sweeps when the harness reports the failing
case clearly. Centralize replay and invariant machinery when it is itself an
owned contract; avoid duplicating the implementation as a test helper.

Delete a test when its behavior is removed, a stronger reliable test demonstrably
subsumes its risk, or review establishes it protects no valid claim. Record the
reason and where any displaced risk is covered or accepted. A property generator
that might eventually hit a historical regression does not replace retaining it.
Quarterly review should examine suite latency, flakes, reruns, time to diagnose,
quarantine age, and tests changed during refactors. Counts are not quality targets.

**Prevents:** suite decay, unexplained coverage loss, and inscrutable failure reports.

### 19. Gate on evidence the team can trust

Run required suites and relevant integration/platform checks before publication.
New gating signals must have known failure semantics, bounded resources, and
actionable reports. Preserve build/revision, command, relevant environment,
seed/schedule, logs, diffs, and minimized cases. Publish only sanitized artifacts.
If introducing dependency-aware selection, validate it periodically against the
full suite. Do not use a presubmit subset as evidence for an unrun release matrix.

Required failures block until fixed, reverted, or explicitly waived under the
applicable repository rules. A broken mainline takes priority over feature work.
Review completion, merge authority, source tags, publication, and a clean consumer
install are distinct checks. A green source build does not establish that Think
can install or use a released git-warp API. This standard cannot grant a merge,
release, or production migration permission.

**Prevents:** green-but-unshipped dependencies and gates that hide uncertainty.

## Think risk map

This is the initial map, not a statement that every row already has full coverage.
The repository maintainer owns this map; each change names the responsible author
and any exception owner in its PR. Review it quarterly and when contracts change.
Detailed active scenarios remain in the suite and METHOD backlog/cycle artifacts.

| Promise and boundary | Oracle and failure exploration | Verification lane / known limit |
| --- | --- | --- |
| Capture preserves raw content; repeated text remains distinct captures | Independently specified content/identity expectations; rejection, publication failure, reopen | Ports plus CLI acceptance; atomicity depends on the selected adapter's contract |
| Derived work and backup cannot rewrite raw thoughts or impersonate local-save failure | Original capture evidence, explicit followthrough/backup outcomes; delay and unavailable local remote | Ports plus acceptance; backup success is separate from local durability |
| Recent, remember, browse, and inspect report the supported history honestly | Required/missing/extra record checks, specified ordering and scope, rebuild differential evidence | Product read tests plus selected surfaces; a cache hit alone is insufficient |
| Minds and host repositories remain isolated | Owned fixture paths, before/after source/config/ref evidence through adapter fixtures; poisoned environment | Environment/CLI/adapter tests; fixture helpers alone are not a complete sandbox |
| Repair/import/export preserve authoritative input and exact content | Independently sourced legacy fixtures, manifests/digests, idempotence, interrupted recovery | Disposable repair and adapter campaigns; no real-mind tests or implied cutover |
| CLI/MCP/macOS preserve ingress/egress contracts | Parsed JSONL/protocol results, exit/refusal behavior, declared UI artifacts | Ports/acceptance and affected Swift tests; Node CI does not establish macOS coverage |
| Capture and re-entry remain affordable as history grows | Same-run comparisons plus explicit product SLO; corpus and cold/warm/maintenance matrix | Benchmark and release campaigns; enforced latency regression gate remains debt |

Experimental stores must declare their own ordered acceptance gates in the active
cycle. Passing an atomic-write example does not establish complete inventory,
replay equivalence, projection rebuild, performance at scale, or surface behavior.
Advance only on the evidence required by that experiment; retain the production
adapter until a separately authorized cutover satisfies all required gates.

## PR evidence and review

Use the [PR template](../.github/PULL_REQUEST_TEMPLATE.md). For each changed claim,
provide its boundary, oracle, checks run, and result. Attach calibration/red-on-base
evidence when applicable, plus replay parameters and resource size for new tests.
Declare unrun relevant checks and linked exceptions plainly. A docs-only change
can say "no runtime claim changed; no new assertions" and run the required local
checks without manufacturing a regression test.

Review in this order:

1. Does the check detect the claimed violation for the intended reason?
2. Is the oracle independent and the expected presence/absence explicit?
3. Does the change kind explain edits to existing expectations?
4. Are the boundary, isolation, resource class, and replay evidence appropriate?
5. Are fault, concurrency, corpus, and performance claims supported where relevant?
6. Are waivers, quarantines, baseline updates, and deletions owned and reviewable?

## References and adaptation

These sources motivate the standard; Think's rules and adoption limits above are
the repository policy, not claims that every cited technique is implemented.

- [Software Engineering at Google, chapter 12](https://abseil.io/resources/swe-book/html/ch12.html): contract boundaries, behavior-oriented tests, change kinds, and readable evidence.
- [How SQLite Is Tested](https://www.sqlite.org/testing.html): regression cases, differential testing, fuzzing, mutation, and fault injection.
- [Google Benchmark: Reducing Variance](https://google.github.io/benchmark/reducing_variance.html): measurement conditions and confounders.

Adapted from the proposed portable Testing Standards: retain the 19 principles;
scale machinery to Think's risk, distinguish evidence from proof, allow justified
test maintenance, preserve real integration checks, and disclose enforcement gaps.
Account for claims, counterexamples, and blind spots.
