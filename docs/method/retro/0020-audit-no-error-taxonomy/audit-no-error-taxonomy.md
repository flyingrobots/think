---
title: "Error taxonomy"
cycle: "0020-audit-no-error-taxonomy"
outcome: hill-met
drift_check: yes
---

# Error taxonomy Retro

## Summary

Introduced ThinkError hierarchy (ValidationError, NotFoundError,
GraphError, CaptureError). Migrated MCP service (7 throws) and
Entry constructor (2 throws) to typed errors. CLI surface unchanged
for now — can migrate in follow-up cycles.

## Drift

- None.

## New Debt

- CLI and store paths still use raw Error in some places.
