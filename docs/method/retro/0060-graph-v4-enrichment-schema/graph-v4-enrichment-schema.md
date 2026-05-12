---
title: "Graph v4 enrichment schema"
cycle: "0060-graph-v4-enrichment-schema"
outcome: hill-met
drift_check: yes
---

# Graph v4 enrichment schema Retro

## Summary

Extended the WARP graph schema for the enrichment pipeline:
- 7 new node prefixes in constants.js
- CLASSIFICATIONS frozen array with 7 types
- PRODUCT_READ_LENS includes all new prefixes
- Migration creates standing classification nodes
- GRAPH_MODEL_VERSION = 4
- 3 new port tests, 191 total pass

## Drift

- Acceptance tests had hardcoded version 3 — updated to 4.

## New Debt

- None.
