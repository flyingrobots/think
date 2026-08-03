---
id: CORE_mcp-capture-warning-assertion-is-timing-dependent
blocks: []
blocked_by: []
---

# MCP capture acceptance test asserts on a wall-clock timeout

`test/acceptance/mcp.test.js` asserts `capture.warnings.length === 0`
after an MCP `capture` call. That warning is emitted only when capture
follow-through exceeds `CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS` (6s, see
`src/mcp/service.js`), so the assertion is really a latency assertion
wearing a correctness assertion's clothes.

Observed: passes in isolation (6/6), fails under `npm run test:m1` when
the acceptance suite runs files concurrently and the machine is loaded —
`actual: 1, expected: 0`. Compounded by
[[CORE_acceptance-tests-cold-spawn]]: every concurrent cold spawn adds
the load that trips the timeout.

The behavior under test is correct either way — a deferred warning still
returns `status: "saved_locally"`, which is the actual contract. The test
just cannot distinguish "follow-through completed" from "this machine was
busy."

Options:

- inject the follow-through timeout so the test pins it deterministically
  instead of racing a real 6s clock
- assert on `status` and `entryId` only, and cover the deferred-warning
  path with the existing dependency-injected port test in
  `test/ports/mcp-service.test.js`, which already exercises it without a
  wall clock
