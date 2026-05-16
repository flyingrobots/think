---
id: SURFACE_macos-appstate-composition-root
blocks: []
blocked_by: []
---

# CaptureAppState constructs concrete macOS dependencies directly

The Swift adapter layer has good protocol seams, but
`CaptureAppState` remains a composition hotspot. It constructs concrete
MCP/CLI clients, metrics recorders, panel controllers, hotkey monitors,
notification tasks, retry behavior, update polling, and process restart
logic in one app-state class.

## Acceptance Criteria

- Introduce an explicit macOS composition root or factory.
- Inject capture client, metrics recorder, panel controller, hotkey
  monitor, restart port, and build-update reader into app state.
- Move process restart behind a port instead of constructing `Process`
  inside `CaptureAppState`.
- Split retry orchestration from menu-bar state.
- `CaptureAppState.swift` is no more than 250 lines, or is split into
  multiple files with exactly one primary responsibility per file.
- A primary responsibility is a single class, struct, actor, or small cohesive
  set of closely related functions that implement one feature or concern.
