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
- [x] Read the bounded native index page set concurrently at one captured v19
      coordinate while preserving newest-first order. Six installed-wrapper
      runs on `~/.think/codex` reduced median `codex-think --remember --json`
      wall time from 11.111s to 4.814s at `/Users/james` and from 11.161s to
      5.081s at `/Users/james/git/think`.
- [ ] Add a deterministic large-mind fixture or synthetic benchmark for MCP read
      timeout budgets.
- [ ] Add an explicit read-model backfill/repair command for existing minds so
      old captures can enter the bounded indexes without default recall scanning
      from genesis.
- [ ] Establish target budgets for `recent`, `stats`, `doctor`, and `remember`
      against large repaired minds. Current `codex-think --remember --json`
      exits reliably on `~/.think/codex`, but its 4.814-5.081s median remains
      above the sub-second product doctrine; the measured scan phase still
      consumes about 3.7s for nine bounded v19 index-page reads.
- [ ] Document and automate safe maintenance for high-loose-object minds.
- [x] Prefer public worldline/optic bounded reads where broad transitional
      queries are not required.
