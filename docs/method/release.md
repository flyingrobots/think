# Release

## Versioning

Think starts versioning at `0.1.0`. Releases happen when externally meaningful behavior changes — not every cycle is a release.

## Release discipline

1. Cycle closeout produces the release candidate state.
2. `package.json` version is bumped on the release commit.
3. A Git tag is created on the commit that lands on `main` for that release.
4. CHANGELOG is updated at every cycle close. README is updated when the user-facing surface changed.

## Pre-release checklist

- All acceptance tests pass (`npm test`).
- macOS Swift tests pass (`npm run test:local`).
- Pre-push hook passes cleanly.
- CHANGELOG has an entry for every user-visible change.
- README reflects the current feature surface.
