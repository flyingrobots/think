---
title: "Git binary path trust"
cycle: "0021-audit-git-binary-path-trust"
outcome: hill-met
drift_check: yes
---

# Git binary path trust Retro

## Summary

GIT_BINARY resolved once via 'which git', exported from git.js,
used by both git.js (3 sites) and project-context.js (1 site).

## Drift

- None.
