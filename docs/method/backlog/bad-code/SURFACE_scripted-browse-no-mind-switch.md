---
id: SURFACE_scripted-browse-no-mind-switch
blocks: []
blocked_by:
  - DX-018-explicit-mind-management
---

# Scripted browse path does not support switch_mind action

The scripted browse test runner (`src/browse-tui/script.js`) does not
handle a `switch_mind` action type. Mind switching can only be tested
manually, not through the acceptance test harness.

Noted in cycle 0004 retro as new debt.
