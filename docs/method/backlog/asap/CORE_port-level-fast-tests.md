# Add port-level tests with in-memory adapters

## Problem

The entire test suite (~135 tests) runs as end-to-end CLI tests that spawn real `node ./bin/think.js` processes, bootstrap real git repos in temp directories, and run real git operations. The full suite takes ~3 minutes. The pre-push hook runs the full suite, meaning every push blocks for 3 minutes.

The slowest tests (7–13 seconds each) capture multiple thoughts into fresh repos, then verify browse/session/inspect behavior. Each test pays the cost of `git init` + multiple `git add` + `git commit` cycles.

## Opportunity

Think uses hexagonal architecture. The domain logic (capture, browse windowing, session traversal, reflect lifecycle, remember, stats) sits behind store ports. None of that logic *requires* git to verify correctness.

Introduce an in-memory store adapter and write port-level tests that exercise the domain through the ports without touching git or the filesystem. These tests should run in milliseconds, not seconds.

## Proposed split

- **Port-level tests** (~100+): in-memory adapter, test domain logic directly. Sub-second total.
- **E2E smoke tests** (~15-20): real CLI, real git, verify the full stack wires correctly. Keep these for CI and pre-push to main.
- **Pre-commit**: lint only (already the case).
- **Pre-push**: port-level tests always, E2E tests only on main (already gated).

## Impact

- Iteration turnaround: push goes from ~3 minutes to seconds
- RED→GREEN cycle: test feedback in milliseconds instead of seconds per test
- CI still runs the full E2E suite for confidence

## Implementation notes

- The in-memory adapter needs to implement the same store port interface as the git-backed store
- Existing E2E tests don't need to change — they become the smoke tier
- New domain tests can be written TDD-style with instant feedback
