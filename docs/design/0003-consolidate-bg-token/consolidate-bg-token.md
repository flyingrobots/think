---
title: "Consolidate BG_TOKEN definition"
legend: "SURFACE"
cycle: "0003-consolidate-bg-token"
source_backlog: "docs/method/backlog/inbox/SURFACE_consolidate-bg-token.md"
---

# Consolidate BG_TOKEN definition

Source backlog item: `docs/method/backlog/inbox/SURFACE_consolidate-bg-token.md`
Legend: SURFACE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`BG_TOKEN` is defined once, in the module that owns the palette.

## Playback Questions

### Human

- [ ] Is BG_TOKEN defined only in `style.js`?

### Agent

- [ ] Do `view.js` and `overlays.js` import BG_TOKEN from `style.js`?
- [ ] Do all browse TUI tests still pass?

## Accessibility and Assistive Reading

- Not applicable — internal refactor, no behavior change.

## Localization and Directionality

- Not applicable.

## Agent Inspectability and Explainability

- Not applicable.

## Non-goals

- No visual or behavioral change to the browse TUI

## Design

Move `BG_TOKEN` from `view.js` and `overlays.js` into `style.js`
(alongside `PALETTE`). Both consumers import from `style.js`.
