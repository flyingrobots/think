---
title: "semantic_parse enrichment stage"
legend: "CORE"
cycle: "0063-semantic-parse-stage"
source_backlog: "docs/method/backlog/asap/CORE_semantic-parse-stage.md"
---

# semantic_parse enrichment stage

Source backlog item: `docs/method/backlog/asap/CORE_semantic-parse-stage.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

After enrichment, every thought has at least one `classified_as`
edge to a standing classification node. Users can query "all
questions" or "all decisions" by traversing the graph.

## Playback Questions

### Human

- [ ] After enriching, can I find all my questions?
- [ ] Does a thought get multiple classifications when it matches
      multiple patterns?

### Agent

- [ ] Does `classifyThought(text)` return correct types for
      questions, decisions, observations, action items, and ideas?
- [ ] Does a thought that matches no pattern get `unclassified`?
- [ ] Does the enrichment pipeline create `classified_as` edges?
- [ ] Does a receipt artifact track the classification result?
- [ ] Is the stage idempotent (re-run doesn't duplicate edges)?

## Accessibility and Assistive Reading

- Linear truth: classifications are plain text labels.
- `--json` provides machine-readable classification data.

## Localization and Directionality

- English-only pattern matching in this cycle.

## Agent Inspectability and Explainability

- The `semantic_parse` receipt artifact records: classifications
  matched, patterns triggered, confidence (1.0 for pattern match).

## Non-goals

- No LLM — pattern matching only
- No entity extraction (separate stage)
- No browse TUI classification filter (separate cycle)

## Design

### Classification patterns

| Type | Patterns |
|------|----------|
| `question` | Contains `?`, starts with "how", "what", "why", "when", "where", "who", "can", "should", "could", "would", "is there", "do we" |
| `decision` | Contains "I decided", "we decided", "decision:", "going with", "chose to", "picking" |
| `observation` | Contains "I noticed", "I observed", "it seems", "turns out", "interesting that", "realized" |
| `action_item` | Contains "need to", "todo", "must", "should do", "action:", "next step", "follow up" |
| `idea` | Contains "what if", "idea:", "concept:", "maybe we could", "imagine", "proposal" |
| `reference` | Contains URL (http/https), "see:", "ref:", "link:", "source:" |

A thought can match multiple patterns → multiple `classified_as`
edges. If no pattern matches → `classification:unclassified`.

### Graph mutations

```
thought --classified_as--> classification:question
thought --classified_as--> classification:action_item  (multi-class)
artifact --derived_from--> thought                     (receipt)
```

### Integration with enrichment pipeline

Add as a second stage in `runEnrichmentPipeline()`, after auto_tags.
Uses the same capture iteration — no extra graph reads.

### Files to create/modify

- `src/store/enrichment/semantic-parse.js` — classifyThought + patterns
- `src/store/enrichment/runner.js` — add stage to pipeline
- Tests: port-level for classifyThought, acceptance for graph edges
