---
title: "Doctor: extended health checks"
cycle: "0007-doctor-extended-checks"
design_doc: "docs/design/0007-doctor-extended-checks/doctor-extended-checks.md"
outcome: hill-met
drift_check: yes
---

# Doctor: extended health checks Retro

## Summary

Extended `runDiagnostics` with graph model version and entry count
checks via optional async callbacks. Both CLI and MCP callers supply
real store access. 5 new port tests.

## Playback Witness

- [verification.md](witness/verification.md) — 171 pass, 0 fail.

## Drift

- None.

## New Debt

- None.

## Cool Ideas

- None.

## Backlog Maintenance

- [x] v0.7.0 lane: only bijou 4.4.1 upgrade + upstream provisioning remain
- [x] Inbox processed
- [x] Dead work buried or merged
