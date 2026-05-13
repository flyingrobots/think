---
id: SURFACE_browse-tui-strict-limits
blocks: []
blocked_by:
  - CORE_runtime-truth-standard-ratchet
---

# Browse TUI exceeds strict human-scale limits

The 2026-05-13 Runtime Truth audit found the browse surface to be the
largest source of size and complexity violations:

- `src/cli/commands/read.js` is 934 lines.
- `src/browse-tui/actions.js` has a 284-line `applyBrowseAction()`
  with complexity 58.
- `src/browse-tui/app.js` mixes terminal I/O, animation, raw input, and
  state orchestration.

Existing backlog already calls out the splash monolith and mind-switch
loop; this item is the broader strict-limits cleanup.

## Acceptance Criteria

- Split browse command orchestration from pure browse state transitions.
- Replace the large action switch with small command handlers or a
  reducer table of runtime-backed actions.
- Move terminal I/O behind a TUI adapter port.
- `src/cli/commands/read.js` falls below 600 lines.
- All browse source files satisfy the 35-line function and complexity 8
  limits.
