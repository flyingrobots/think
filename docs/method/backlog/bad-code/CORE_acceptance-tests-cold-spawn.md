---
id: CORE_acceptance-tests-cold-spawn
blocks: []
blocked_by: []
---

# Acceptance tests spawn a cold Node process per assertion

Every `runThink()` call in the acceptance suite spawns a new Node
process via `spawnSync`. With 125+ acceptance tests, this means
125+ cold ESM module loads (~2s each). The suite takes ~3 minutes.

A warm-process test harness (import `main()` directly, mock
stdin/stdout) could cut this to seconds while keeping the same
assertion semantics.
