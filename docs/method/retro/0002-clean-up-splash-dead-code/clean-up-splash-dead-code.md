---
title: "Clean up splash dead code"
cycle: "0002-clean-up-splash-dead-code"
design_doc: "docs/design/0002-clean-up-splash-dead-code/clean-up-splash-dead-code.md"
outcome: hill-met
drift_check: yes
---

# Clean up splash dead code Retro

## Summary

Removed `renderSplashView()` and its `parseAnsiToSurface` import from
`src/splash.js`. These were dead code left over from the RE-015
workaround that moved splash rendering to direct stdout. One new test
asserts the dead export stays gone.

## Playback Witness

- [verification.md](witness/verification.md) — 144 pass, 0 fail.

## Drift

- None.

## New Debt

- None.

## Cool Ideas

- None.

## Backlog Maintenance

- [x] Inbox processed — one remaining item (BG_TOKEN consolidation)
- [x] Priorities reviewed
- [x] Dead work buried or merged
