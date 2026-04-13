---
title: "Remediation payloads in JSON errors"
cycle: "0032-HT-007-remediation-payloads-in-json-errors"
outcome: hill-met
drift_check: yes
---

# Remediation payloads Retro

## Summary

Added remediation field to graph.migration_required error in both
CLI (graph-gate.js) and MCP (service.js). Agents can parse the
exact command to run for recovery.

## Drift

- None.
