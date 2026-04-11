---
title: "Improve upstream provisioning"
cycle: "0008-improve-upstream-provisioning"
design_doc: "docs/design/0008-improve-upstream-provisioning/improve-upstream-provisioning.md"
outcome: hill-met
drift_check: yes
---

# Improve upstream provisioning Retro

## Summary

Added upstream reachability check to doctor via `git ls-remote`.
When `THINK_UPSTREAM_URL` is set, doctor tests connectivity (read-only,
5s timeout) and reports ok/warn instead of just ok/skip. Added
`lsRemote()` to git.js. 2 new port tests.

## Playback Witness

- [verification.md](witness/verification.md) — 173 pass, 0 fail.

## Drift

- None.

## New Debt

- None.

## Cool Ideas

- None.

## Backlog Maintenance

- [x] v0.7.0 lane: only bijou 4.4.1 upgrade remains
- [x] Inbox processed
- [x] Dead work buried or merged
