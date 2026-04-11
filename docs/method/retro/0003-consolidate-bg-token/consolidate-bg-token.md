---
title: "Consolidate BG_TOKEN definition"
cycle: "0003-consolidate-bg-token"
design_doc: "docs/design/0003-consolidate-bg-token/consolidate-bg-token.md"
outcome: hill-met
drift_check: yes
---

# Consolidate BG_TOKEN definition Retro

## Summary

Moved `BG_TOKEN` from duplicate definitions in `view.js` and
`overlays.js` into `style.js` alongside `PALETTE`. Extracted a `toHex`
helper for the RGB-to-CSS conversion. Removed the now-unused `PALETTE`
import from `view.js`.

## Playback Witness

- [verification.md](witness/verification.md) — 145 pass, 0 fail.

## Drift

- None.

## New Debt

- None.

## Cool Ideas

- None.

## Backlog Maintenance

- [x] Inbox processed — all three bijou 4.4.0 items complete
- [x] Priorities reviewed
- [x] Dead work buried or merged
