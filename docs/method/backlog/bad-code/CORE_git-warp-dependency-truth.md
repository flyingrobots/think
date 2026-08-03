---
id: CORE_git-warp-dependency-truth
blocks: []
blocked_by:
  - CORE_repair-v17-git-warp-minds
---

# git-warp dependency truth must stay anchored to package metadata

Think runtime compatibility must be proven against the published
`@git-stunts/git-warp` package declared in `package.json`, not against a linked
local checkout or private package internals. The current product runtime targets
the public Runtime, Lane, Intent, Observer, and captured-coordinate APIs in
`@git-stunts/git-warp@19.0.2`; legacy checkpoint repair remains quarantined in
the v17 repair lane.

## Acceptance Criteria

- `npm ls @git-stunts/git-warp` exits cleanly in a normal checkout.
- `package.json` and `package-lock.json` match the intended git-warp version.
- The intended version is published or resolved through an explicit,
  documented local/workspace dependency path.
- Product read/write tests pass from a clean install, not only from a local
  linked git-warp checkout.
- The archived v17 repair acceptance fixture runs its full repair assertion in
  clean CI instead of skipping when the v17 migration package is unavailable.
- No production module imports private `node_modules/@git-stunts/git-warp/src`
  paths or git-warp cache/checkpoint compatibility helpers.
