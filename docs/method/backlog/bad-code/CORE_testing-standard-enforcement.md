---
id: CORE_testing-standard-enforcement
blocks: []
blocked_by: []
---

# CORE - Make testing-standard enforcement executable

Legend: CORE

## Problem

[Testing Standards](../../../TESTING_STANDARDS.md) are adopted for review, but the
current Node CI runs lint and ports/acceptance tests without repository-wide size
classification, resource sandboxing, suite budgets, or owned quarantine/XFAIL
reporting. Benchmark harness tests, Swift tests, and sustained fuzz/fault/performance
campaigns are separate. Test directory names do not establish resource size.

The maintainer owns prioritization. Assign a named implementation owner when this
card is pulled into a METHOD cycle. This card records missing machinery; it is not
a waiver of new-test evidence requirements or an authorization to weaken gates.

## Small, independently reviewable slices

1. Inventory tests through the package scripts and fixture entrypoints. Record
   resource classes, real host dependencies, cleanup ownership, and relevant
   Node/Git/Swift versions. Measure suite p50/p95 and flake rates on named workers
   before proposing budgets. Avoid a mass test rewrite.
2. Introduce test/group size declarations with validated timeouts, child-process
   deadlines/cleanup, and resource enforcement. Calibrate the enforcement using a
   forbidden resource access and a stalled child; prove they fail for the intended
   reason. Ratchet explicitly inventoried legacy exceptions.
3. Close fixture isolation gaps: owned homes and repos, scrubbed selectors and Git
   configuration, cleanup on failure, no ambient network, and repeat/shuffle/parallel
   probes for affected fixtures. Record environment assumptions still uncontained.
4. Add visible quarantine/XFAIL records with issue, owner, expiry, preserved first
   failure, and unexpected-pass handling. Expiry must escalate, not auto-delete
   the sole test of a critical behavior. Calibrate both verdict directions.
5. Add replayable corpus/fault targets for the highest-risk parser and durability
   claims. Keep minimized sanitized regressions in ordinary CI, bounded exploration
   on schedule, and seeds/configuration outside the worker process. Record supported
   shrinking and schedule replay limits.
6. Surface per-change failure evidence and suite trust/cost reports without gating
   on coverage or mutation percentages. Make any new CI requirement explicit and
   retain the stable `ci` context.

## Coordination

- [CORE_acceptance-tests-cold-spawn](CORE_acceptance-tests-cold-spawn.md) owns
  reducing acceptance startup overhead. Preserve representative real CLI tests
  when adding warm in-process coverage.
- [CORE_audit-no-latency-regression-gate](CORE_audit-no-latency-regression-gate.md)
  owns the capture performance gate. Supply measurements and harness calibration
  from that work rather than create a second performance gate here.
- The active storage/repair experiment owns its specific fault matrix and ordered
  acceptance gates. This card supplies shared machinery as justified by that work.

## Completion evidence

Each completed slice records its command, exact revision, calibrated failure,
green result, and remaining blind spots. Update the standards' enforcement status
and command table as machinery lands. Close this card only when each slice is
implemented or moved to a specifically owned, linked follow-on card with an
explicit disposition; a passing pre-existing suite is not completion evidence.
