## Summary

<!-- What changed and why -->

Change kind: <!-- refactor/optimization, new feature, bug fix, deliberate behavior change; or docs/build/test maintenance with reason. Scope mixed changes. -->

## Test plan

- [ ] `npm run lint` passes
- [ ] `npm run test:ports` passes
- [ ] `npm run test:m1` passes
- [ ] Docs updated if user-facing

## Test evidence

<!-- Follow docs/TESTING_STANDARDS.md. Keep this proportional to the change.
Docs-only: state that no runtime claim changed and no new assertions were added.
Record relevant unrun checks instead of implying that test:fast covers every lane. -->

- Contract / boundary and oracle:
- Commands, revision, and results (including unrun relevant checks):
- New/changed load-bearing assertions: observed failure, then green evidence; for bugs, include the unfixed revision and intended failing check:
- New tests: resource size / timeout; seed, schedule, corpus, or replay command when applicable:
- Changed expectations, baselines, or deleted tests: reason and displaced risk:
- Remaining gaps / exceptions: issue or backlog, named owner, review date, and approving maintainer when a waiver is needed:

## Runtime Truth checklist

- [ ] Core/domain code stays behind ports and adapters
- [ ] Dependencies are injected from composition roots
- [ ] Encoding/decoding stays at boundaries
- [ ] Important runtime concepts use constructor-validated models
- [ ] No new generic source `Error`/`TypeError` throws
- [ ] No new strict-limit ratchet regressions
