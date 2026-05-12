---
title: "Eliminate full graph materialization anti-pattern"
cycle: "0065-eliminate-full-graph-materialization"
design_doc: "docs/design/0065-eliminate-full-graph-materialization/eliminate-full-graph-materialization.md"
outcome: partial
drift_check: yes
---

# Eliminate full graph materialization anti-pattern Retro

## Summary

Rewrote migrations.js, enrichment/runner.js, and queries.js to use
worldline query API instead of getNodes()/getEdges(). Static analysis
test enforces zero full-materialization calls in src/.

**Partial** because the v2→v4 migration test fails. The worldline
query API doesn't find edges correctly on repos that were downgraded
by the test fixture. Needs further investigation into how worldline
queries interact with edge-stripped repos.

## Drift

- v2 migration test broken — filed as remaining work.

## New Debt

- Fix v2→v4 migration test (worldline query on downgraded repos)
- The --recent default limit change was started but interrupted —
  listRecent now returns { entries, total } but needs a follow-up
  cycle to complete

## Backlog Maintenance

- [x] Done
