# Bearing

Updated: 2026-04-03

## Where are we going?

Validation and hardening. Five milestones are shipped. `v0.5.0` is released. METHOD is adopted. The capture habit, read surfaces, and ingress options all work. The next phase is proving them under real use, not adding features.

## What just shipped?

`v0.5.0` — MCP server, stdin ingest, URL capture, macOS app bundling, ESLint, CI, tag-triggered release workflow, System-Style JavaScript adoption, METHOD adoption with three legends, complete GUIDE.md.

## What feels wrong?

- **No active METHOD cycle.** Everything so far was pre-METHOD or migration work. The first real METHOD cycle hasn't started yet.
- **Shape soup in the MCP service layer.** The MCP tools return plain objects — no runtime-backed domain types. Under SSJD, this is debt. Not blocking, but it's there.
- **CONTRIBUTING.md is drifting.** It still references the old milestone development loop and IBM Design Thinking framing. Should be updated to reflect METHOD.
- **The up-next items are all validation work.** That's correct — but it means the first METHOD cycle will be a measurement/observation cycle, not a feature cycle. That's fine. It's what the product needs.
