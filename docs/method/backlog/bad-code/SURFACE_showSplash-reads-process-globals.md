---
id: SURFACE_showSplash-reads-process-globals
blocks: []
blocked_by: []
---

# showSplash reads process.stdout directly

`showSplash()` reads `process.stdout.columns`, `process.stdout.rows`,
and manages `process.stdin.setRawMode` directly. Same boundary
violation we fixed in the store layer — terminal I/O should be
injected, not hardcoded.

This makes the splash untestable without a real terminal.
