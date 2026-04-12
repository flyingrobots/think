# openWarpApp handle reuse

`openWarpApp` is called multiple times across `saveRawCapture` and
`finalizeCapturedThought`, creating redundant repository handles.
Implement a simple singleton cache in `src/store/runtime.js` that
reuses open app handles for the same `repoDir` during a single
execution tick.

Source: code-quality audit 2026-04-11 §4.2.
