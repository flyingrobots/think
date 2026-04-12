---
title: "Multiple minds"
cycle: "0004-multiple-minds"
design_doc: "docs/design/0004-multiple-minds/multiple-minds.md"
outcome: hill-met
drift_check: yes
---

# Multiple minds Retro

## Summary

Multi-mind browsing across two surfaces: splash and browse TUI.

- `discoverMinds()` scans `~/.think/` for directories with git repos
- `shaderForMind()` assigns a deterministic shader per mind (djb2 hash)
- Splash: Tab cycles minds with shader change, Shift+Tab backward
- Browse: `m` opens a command palette to switch minds (full re-bootstrap)
- Seamless transition: splash fades to plum, browse content fades in
  from plum over 800ms, bijou takes over without screen flash

The longest cycle this session. Three bugs were fixed during integration:
1. ctx was never passed to createFramedApp (caused missing bg — not a
   bijou bug despite what we initially thought)
2. Alt screen double-entry caused a screen-clear flash
3. Content popped in after splash fade — added manual fade-in loop

## Playback Witness

- [verification.md](witness/verification.md) — 173 pass, 0 fail.
- Manual: splash shows "◀ default ▶" with 5 discovered minds,
  Tab cycles with distinct shaders, Enter opens selected mind,
  `m` opens mind palette in browse.

## Drift

- Filed a false bijou bug report (bg fill regression). The real issue
  was Think not passing ctx to createFramedApp. Bug report should be
  updated or archived.

## New Debt

- Scripted browse path does not support `switch_mind` action yet.
- `browseStartMs` field added to model but unused after fade-in
  was moved outside bijou.

## Cool Ideas

- Per-mind color themes (not just shaders — distinct palettes)
- Mind creation CLI: `think --mind=work "thought"` to capture into a
  specific mind

## Backlog Maintenance

- [x] Inbox processed
- [x] Priorities reviewed
- [x] Dead work buried or merged
