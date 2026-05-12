---
title: "Prompt metrics IOPort"
cycle: "0040-audit-prompt-metrics-io-port"
outcome: hill-met
drift_check: yes
---

# Prompt metrics IOPort Retro

## Summary

readPromptMetricsRecords accepts an optional reader function,
defaulting to readFile. Tests can inject in-memory readers.

## Drift

- None.
