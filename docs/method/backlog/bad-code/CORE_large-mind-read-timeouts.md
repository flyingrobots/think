# CORE: Large-mind read paths exceed agent timeout budgets

## Problem

Large repaired git-warp minds can exceed normal MCP client timeout budgets on
read-heavy paths such as `recent`, `stats`, and `doctor`. The Claude mind at
`~/.think/claude` was observed with roughly 43k loose Git objects and read
commands taking 14-21 seconds even after the raw capture path itself was fast.

Default recall also regressed when `remember` asked broad `entry:*` and
`keyword:*` questions, then sorted and sliced after the runtime had already
answered the broad query.

## Why It Matters

Capture can return after local raw save, but agents still need reliable re-entry
surfaces. If reads routinely exceed client budgets, agents experience Think as
unavailable even when the underlying mind is intact.

## Acceptance Criteria

- [x] Route default `remember`, `recent`, and browse bootstrap through bounded
      Think read-model facts instead of broad capture wildcard scans.
- [x] Add port-level ratchets proving default ambient and explicit remember do
      not call `read.view.query()`.
- [x] Store self-contained fast capture records so default `remember` can score
      ambient project matches without hydrating capture nodes.
- [ ] Add a deterministic large-mind fixture or synthetic benchmark for MCP read
      timeout budgets.
- [ ] Add an explicit read-model backfill/repair command for existing minds so
      old captures can enter the bounded indexes without default recall scanning
      from genesis.
- [ ] Establish target budgets for `recent`, `stats`, `doctor`, and `remember`
      against large repaired minds. Current `codex-think --remember --json`
      smoke exits under a 20s timeout on `~/.think/codex`, but still spends
      roughly 13-14s in one git-warp optic property read.
- [ ] Document and automate safe maintenance for high-loose-object minds.
- [ ] Prefer public worldline/optic bounded reads where broad transitional
      queries are not required.
