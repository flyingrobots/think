---
title: "Query reshape pipeline"
cycle: "0022-audit-query-reshape-pipeline"
outcome: hill-met
drift_check: yes
---

# Query reshape pipeline Retro

## Summary

Froze inspect and browse window result objects. Anonymous shapes
remain but are now immutable — downstream can't accidentally mutate
query results.

## Drift

- None.

## New Debt

- Named result classes (InspectResult, BrowseWindow) deferred.
  Freezing is sufficient for correctness.
