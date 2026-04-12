---
id: SURFACE_modelref-side-effect-mutation
blocks: []
blocked_by: []
---

# modelRef side-effect mutation in browse page

The browse page updates model state in two places: the immutable
return value from `update()` AND via side-effect mutation of
`modelRef.current`. This implicit contract means any code path that
forgets to sync the ref leaves the parent observing stale state.

Action-at-a-distance: page.js mutates state owned by app.js.

Files: `src/browse-tui/page.js`, `src/browse-tui/app.js`
