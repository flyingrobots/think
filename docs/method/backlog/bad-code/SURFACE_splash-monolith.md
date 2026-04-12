---
id: SURFACE_splash-monolith
blocks: []
blocked_by: []
---

# showSplash is a 126-line monolith mixing animation and I/O

`showSplash()` directly manages process.stdout, raw mode, frame
rendering, input handling, mind cycling, and transition state all in
one function with nested closures. The animation/state logic is
untestable because it's buried inside side-effectful I/O.

Extract a pure splash state machine that takes (state, elapsed, input)
and returns (nextState, frameData). Let showSplash just orchestrate
I/O around it.

File: `src/browse-tui/app.js`
