---
id: CI-004-canonical-smoke-mind-as-cas-fixture
blocks: []
blocked_by: []
---

# Ship a canonical smoke mind as a git-cas fixture CI can restore

An 80-second real-mind smoke run (capture → ambient recall → explicit query →
stats → doctor → MCP round trip, 22 assertions) caught behaviour the acceptance
suite does not assert at all — notably that a deferred capture stays recallable
through `remember` while `recent` and `stats` under-report it. It ran against a
throwaway mind created on the spot, so nothing in CI exercises that path.

The repo already has the mechanism: `test/acceptance/repair-v17-mind.test.js`
restores an archived mind tarball through git-cas from a manifest in
`test/fixtures/cas/`. A canonical smoke mind could ship the same way.

## Blocker: git-cas fixtures are not CI-portable today

git-cas stores its objects under `refs/cas/*`. The default push refspec is
`refs/heads/*`, so those refs never reach the remote:

```bash
$ git for-each-ref refs/cas/     # local
refs/cas/vault -> cc066d75bfc6251f774aac6e0c605712c1973b0b
$ git ls-remote origin 'refs/cas/*' | wc -l
0
```

A fresh clone — every CI run — therefore cannot restore
`test/fixtures/cas/gemini-pre-v17-mind.json`. This was latent because CI's
`npm test` runs `test:ports` first and had been failing there, so `test:m1`
never reached the fixture. The v17 guard only checked for the git-warp
migration, not for the fixture data, so the test would have *failed* on an
unreachable object id rather than reporting missing data. A CAS-availability
precondition now makes both tests skip with the reason instead.

Building the smoke fixture on this foundation as-is would produce a test that
passes locally and skips (or fails) in CI — no coverage where it is wanted.

## Order of work

1. **Make CAS reachable from CI.** Push `refs/cas/*` (explicit refspec or a
   release step) and have the workflow fetch it. Verify from a fresh clone, not
   from a working tree that already has the objects.
2. **Build the fixture deterministically.** Seed a mind with a fixed set of
   captures using `THINK_TEST_NOW` so entry ids and sort keys are stable, tar it,
   `git-cas store`, and commit a manifest alongside the existing one.
3. **Add the acceptance test.** Restore, verify the sha256, extract, then assert
   the smoke behaviours — including that a deferred capture is absent from
   `recent` yet still found by `remember`, which is the property with no coverage
   today.
4. **Keep the precondition.** Skip with an explicit reason when CAS is
   unavailable, so a transport regression reads as missing data rather than a
   broken fixture.

## Why it is worth it

The smoke script found real defects in ~80 seconds where the acceptance suite
takes ~20 minutes of cold spawns (see [[CORE_acceptance-tests-cold-spawn]]). A
restorable canonical mind removes the per-run seeding cost and turns those
assertions into something CI can enforce.
