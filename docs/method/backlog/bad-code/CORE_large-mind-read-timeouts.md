# CORE: Large-mind read paths exceed agent timeout budgets

## Problem

Large repaired git-warp minds can exceed normal MCP client timeout budgets on
read-heavy paths such as `recent`, `stats`, and `doctor`. The Claude mind at
`~/.think/claude` was observed with roughly 43k loose Git objects and read
commands taking 14-21 seconds even after the raw capture path itself was fast.

## Why It Matters

Capture can return after local raw save, but agents still need reliable re-entry
surfaces. If reads routinely exceed client budgets, agents experience Think as
unavailable even when the underlying mind is intact.

## Acceptance Criteria

- [ ] Add a deterministic large-mind fixture or synthetic benchmark for MCP read
      timeout budgets.
- [ ] Establish target budgets for `recent`, `stats`, `doctor`, and `remember`
      against repaired checkpoint-backed minds.
- [ ] Document and automate safe maintenance for high-loose-object minds.
- [ ] Prefer checkpoint-backed bounded reads where whole-graph observer startup is
      not required.
