# Store runtime reconstructs trusted entries from raw graph props

`src/store/runtime.js` turns raw graph node properties directly into store entry objects without a schema or runtime-backed constructor boundary.

This is a core correctness risk because every read surface downstream inherits whatever that raw graph shape happens to be.
