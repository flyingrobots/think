---
title: "think --annotate"
cycle: "0061-annotate-command"
outcome: hill-met
drift_check: yes
---

# think --annotate Retro

## Summary

First enrichment surface. Users can annotate existing captures via
--annotate=<entryId> "text". Annotations are graph nodes linked by
annotates edges. Visible in --inspect. 4 new acceptance tests.

Found that ENTRY_KINDS didn't cover text-bearing enrichment nodes.
Added TEXT_CONTENT_KINDS constant for kinds that store content.

## Drift

- None.

## New Debt

- MCP annotate tool (follow-up)
- Browse TUI 'a' key (follow-up)
