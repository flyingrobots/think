---
id: CORE_git-warp-dependency-truth
blocks: []
blocked_by:
  - CORE_repair-v17-git-warp-minds
---

# git-warp dependency truth is split between package metadata and local v17 links

Think currently declares `@git-stunts/git-warp` as `15.0.0`, while local
development can resolve to a linked `17.0.0` checkout. That makes
`npm ls @git-stunts/git-warp` fail with `ELSPROBLEMS` and leaves runtime
compatibility depending on local workspace state rather than package truth.

The checkpoint read path now includes a public-reader compatibility bridge for
`createStateReader` vs `createStateReaderV5`. That bridge is acceptable as a
short-term guard, but it should not become permanent dependency sludge.

## Acceptance Criteria

- `npm ls @git-stunts/git-warp` exits cleanly in a normal checkout.
- `package.json` and `package-lock.json` match the intended git-warp version.
- The intended version is published or resolved through an explicit,
  documented local/workspace dependency path.
- Checkpoint read tests pass from a clean install, not only from a local
  linked git-warp checkout.
- The state-reader compatibility bridge is either documented as intentional
  version support or removed after the dependency cutover.
