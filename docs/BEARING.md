# Bearing

Updated: 2026-04-03

## Where are we going?

Finishing M5 (additional ingress surfaces) and preparing for a `0.1.0` release. The MCP server just shipped, giving agents typed access to the full Think runtime. The capture habit is proven, the read surfaces work, and the ingress options are broadening. The next meaningful external milestone is a publishable release.

## What just shipped?

Local stdio MCP server — `capture`, `recent`, `remember`, `browse`, `inspect`, `stats`, `prompt_metrics`, and `migrate_graph` tools over the existing Think runtime. Three acceptance tests. System-Style JavaScript adopted as the engineering standard.

## What feels wrong?

- **METHOD adoption is fresh.** The backlog just migrated from a monolithic BACKLOG.md to filesystem lanes. The historical milestones (M0–M5) and their retrospectives predate METHOD and live in the old structure. New work uses METHOD; old work stays where it is.
- **No active cycle.** The MCP work was committed directly to main before METHOD was in place. The next piece of work should be the first proper METHOD cycle.
- **Release readiness is unclear.** What exactly needs to happen before `0.1.0`? The capture path works, the MCP works, the macOS app works. Is there a release-prep cycle, or do we just cut it?
- **Shape soup in the MCP service layer.** The MCP tools return plain objects — no runtime-backed domain types. Under the newly adopted SSJD, this is debt. Not blocking, but it's there.
