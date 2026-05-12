---
title: "CLI still hides too much behind a generic top-level error"
cycle: "0057-audit-cli-generic-errors"
design_doc: "docs/design/0057-audit-cli-generic-errors/audit-cli-generic-errors.md"
outcome: hill-met
drift_check: yes
---

# CLI still hides too much behind a generic top-level error Retro

## Summary

Replaced generic "Something went wrong" catch-all with typed error
handling. ThinkError subclasses surface their message directly.
Unknown errors append the message to the generic prefix for
actionable self-serve debugging context.

## Playback Witness

Add artifacts under `docs/method/retro/0057-audit-cli-generic-errors/witness` and link them here.

## Drift

- None recorded.

## New Debt

- None recorded.

## Cool Ideas

- None recorded.

## Backlog Maintenance

- [ ] Inbox processed
- [ ] Priorities reviewed
- [ ] Dead work buried or merged
