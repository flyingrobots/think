---
title: "CLI options bag"
cycle: "0028-audit-cli-options-bag"
outcome: hill-met
drift_check: yes
---

# CLI options bag Retro

## Summary

Froze the parsed options object and positionals array. The bag is
still one large object, but it's now immutable. Named command forms
deferred — the current shape is serviceable.

## Drift

- None.
