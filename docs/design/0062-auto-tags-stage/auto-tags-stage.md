---
title: "auto_tags enrichment stage"
legend: "CORE"
cycle: "0062-auto-tags-stage"
source_backlog: "docs/method/backlog/asap/CORE_auto-tags-stage.md"
---

# auto_tags enrichment stage

Source backlog item: `docs/method/backlog/asap/CORE_auto-tags-stage.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

After capture, the enrichment pipeline extracts topic keywords from
the thought and links the thought to topic nodes in the graph. Users
can query "thoughts about X" by traversing topic graph edges.

## Playback Questions

### Human

- [ ] After capturing a thought about "performance optimization",
      can I find it by querying topic:performance?
- [ ] Do topics only become graph nodes after appearing in multiple
      thoughts (promotion threshold)?

### Agent

- [ ] Does `extractTopics(text, corpus)` return relevant keywords
      without an LLM?
- [ ] Does the auto_tags stage create `about` edges from thoughts
      to topic nodes?
- [ ] Does a receipt artifact track what was extracted and when?
- [ ] Are candidate topics below the threshold stored on the receipt
      (not as graph nodes)?
- [ ] Does re-running the stage on the same thought produce the same
      result (idempotent)?
- [ ] Does a new CLI command (`--topics`) list all promoted topics?

## Accessibility and Assistive Reading

- Linear truth: topics are plain text labels. No visual-only
  representation.
- `--json --topics` provides machine-readable topic list.

## Localization and Directionality

- Topic names are normalized to lowercase. No locale-specific
  normalization in this cycle.

## Agent Inspectability and Explainability

- The `auto_tags` receipt artifact records: extracted topics, method
  used, topics promoted to nodes, deriver version.
- `--inspect` shows the receipt alongside other derivations.

## Non-goals

- No LLM — keyword extraction is corpus-statistical or pattern-based
- No TF-IDF in this first cut — use simple noun-phrase extraction
  with stopword filtering. TF-IDF requires a corpus index that
  doesn't exist yet.
- No topic merging/aliases (separate cycle)
- No browse TUI topic panel (separate cycle)

## Design

### Topic extraction algorithm (v1: simple)

1. Lowercase the thought text
2. Split on whitespace and punctuation
3. Remove stopwords (common English words)
4. Remove tokens < 3 characters
5. Count unique tokens
6. Return tokens that appear in the text, sorted by position

This is intentionally simple. TF-IDF and noun-phrase extraction
are future improvements — the stage architecture supports swapping
the algorithm via `deriverVersion`.

### Promotion threshold

Default: 2. A topic becomes a graph node after it appears across
2+ distinct thoughts. Below that, the topic name is stored in the
`auto_tags` receipt as a candidate.

When a candidate crosses the threshold during a pipeline run, the
stage:
1. Creates `topic:<normalized-name>` node
2. Backfills `about` edges for all prior thoughts that had the
   candidate in their receipt

### Graph mutations per thought

```
thought --about--> topic:<name>    (one per promoted topic)
artifact --derived_from--> thought (receipt)
```

### CLI: `--topics`

```bash
think --topics                # list all promoted topics
think --topics --json         # JSONL topic list
```

### Files to create/modify

- `src/store/enrichment/auto-tags.js` — extraction + stage logic
- `src/store/enrichment/stopwords.js` — stopword list
- `src/cli/commands/read.js` — `runTopics` command
- `src/cli/options.js` — `--topics` flag
- `src/cli.js` — dispatch
- `src/store/constants.js` — topic promotion threshold constant
