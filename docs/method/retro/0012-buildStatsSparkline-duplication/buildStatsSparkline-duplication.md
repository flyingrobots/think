---
title: "DRY sparkline duplication"
cycle: "0012-buildStatsSparkline-duplication"
outcome: hill-met
drift_check: yes
---

# DRY sparkline duplication Retro

## Summary

formatStats now calls buildStatsSparkline instead of duplicating the
buckets→sparkline transformation. One call site changed.

## Drift

- None.
