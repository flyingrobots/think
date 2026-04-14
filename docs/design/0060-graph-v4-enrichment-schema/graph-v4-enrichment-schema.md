---
title: "Graph v4: enrichment schema extension"
legend: "CORE"
cycle: "0060-graph-v4-enrichment-schema"
source_backlog: "docs/method/backlog/asap/CORE_graph-v4-enrichment-schema.md"
---

# Graph v4: enrichment schema extension

Source backlog item: `docs/method/backlog/asap/CORE_graph-v4-enrichment-schema.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

The WARP graph schema supports enrichment nodes and edges at v4.
Migration creates standing classification nodes. No enrichment
logic yet — just the schema.

## Playback Questions

### Agent

- [ ] Does GRAPH_MODEL_VERSION = 4?
- [ ] Does migration create 7 classification nodes?
- [ ] Does PRODUCT_READ_LENS include all new prefixes?
- [ ] Do existing tests still pass after migration?
- [ ] Does --doctor report graph model v4 after migration?

## All postures

Not applicable — internal schema extension.

## Backlog Context

Extend the WARP graph schema for the enrichment pipeline. No new
features — just the foundation so enrichment stages have somewhere
to write.

- New node prefixes: topic, classification, entity, annotation,
  link, evolution, pipeline_run
- New edge labels: about, classified_as, mentions, annotates,
  links_from, links_to, evolves, enriches, alias_of, covers,
  similar_to, summarizes
- Standing classification nodes (7): question, decision,
  observation, action_item, idea, reference, unclassified
- Match lens update for PRODUCT_READ_LENS
- Graph model version 3 → 4 migration

Design: docs/design/enrichment-pipeline.md
