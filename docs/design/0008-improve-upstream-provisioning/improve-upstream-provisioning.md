---
title: "Improve upstream provisioning"
legend: "CORE"
cycle: "0008-improve-upstream-provisioning"
source_backlog: "docs/method/backlog/v0.7.0/CORE_improve-upstream-provisioning.md"
---

# Improve upstream provisioning

Source backlog item: `docs/method/backlog/v0.7.0/CORE_improve-upstream-provisioning.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`think --doctor` tests upstream connectivity when configured, so
operators know immediately if their backup is reachable.

## Playback Questions

### Human

- [ ] Does doctor tell me if my upstream is reachable?
- [ ] Does doctor tell me if my upstream auth is broken?

### Agent

- [ ] Does the upstream check use `git ls-remote` (read-only)?
- [ ] Does it time out gracefully instead of hanging?
- [ ] Does it skip when no upstream is configured?
- [ ] Does the check appear in --json and MCP output?

## Accessibility and Assistive Reading

- Same as doctor — labeled pass/fail text.

## Localization and Directionality

- Not applicable.

## Agent Inspectability and Explainability

- Same `{ name, status, message }` schema.

## Non-goals

- No upstream repo creation/scaffolding
- No backup history/timestamp tracking
- No push — read-only connectivity test only

## Design

Change the existing `upstream` check in `runDiagnostics` from a
simple "is URL set?" to "can we reach it?":

- When `upstreamUrl` is empty → `skip` (unchanged)
- When `upstreamUrl` is set → run `git ls-remote --exit-code <url>`
  with a timeout. `ok` if exit 0, `warn` if unreachable/auth fails.

`git ls-remote` is read-only and fast. It verifies both network
connectivity and authentication without modifying any refs.

Add an optional `checkUpstreamReachable` callback to `runDiagnostics`
(same pattern as graph model / entry count). Callers supply the real
git implementation; tests supply stubs.

### Files to change

- `src/doctor.js` — enhanced upstream check with callback
- `src/cli/commands/read.js` — supply `checkUpstreamReachable`
- `src/mcp/service.js` — supply `checkUpstreamReachable`
- `src/git.js` — add `lsRemote(url, timeout)` function
