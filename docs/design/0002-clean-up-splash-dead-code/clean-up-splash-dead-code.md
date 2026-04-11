---
title: "Clean up splash dead code"
legend: "SURFACE"
cycle: "0002-clean-up-splash-dead-code"
source_backlog: "docs/method/backlog/inbox/SURFACE_clean-up-splash-dead-code.md"
---

# Clean up splash dead code

Source backlog item: `docs/method/backlog/inbox/SURFACE_clean-up-splash-dead-code.md`
Legend: SURFACE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`src/splash.js` exports only what is actually used — no dead code
from the abandoned bijou surface rendering path.

## Playback Questions

### Human

- [ ] Is `renderSplashView` gone from the source?
- [ ] Is the `parseAnsiToSurface` import gone?

### Agent

- [ ] Do all existing splash tests still pass?
- [ ] Does `splash.js` still export `selectLogo` and `renderSplash`?

## Accessibility and Assistive Reading

- Not applicable — removing dead code, no behavior change.

## Localization and Directionality

- Not applicable — no user-facing string changes.

## Agent Inspectability and Explainability

- Not applicable — pure cleanup.

## Non-goals

- No changes to the live splash rendering path
- No attempt to bring splash back into bijou's surface pipeline

## Design

Remove `renderSplashView()` and its `parseAnsiToSurface` import from
`src/splash.js`. No other files reference either.
