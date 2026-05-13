## Summary

<!-- What changed and why -->

## Test plan

- [ ] `npm run lint` passes
- [ ] `npm run test:ports` passes
- [ ] `npm run test:m1` passes
- [ ] Docs updated if user-facing

## Runtime Truth checklist

- [ ] Core/domain code stays behind ports and adapters
- [ ] Dependencies are injected from composition roots
- [ ] Encoding/decoding stays at boundaries
- [ ] Important runtime concepts use constructor-validated models
- [ ] No new generic source `Error`/`TypeError` throws
- [ ] No new strict-limit ratchet regressions
