---
title: "auto_tags enrichment stage"
cycle: "0062-auto-tags-stage"
design_doc: "docs/design/0062-auto-tags-stage/auto-tags-stage.md"
outcome: hill-met
drift_check: yes
---

# auto_tags enrichment stage Retro

## Summary

First automated enrichment stage. extractTopics() does keyword
extraction (stopwords, dedup, normalize). runEnrichmentPipeline()
creates topic nodes when keywords cross promotion threshold (2+
thoughts), adds about edges. CLI: --enrich and --topics.

7 port tests (extractTopics), 2 acceptance tests (--topics after
enrichment, --json --topics). 204 total tests pass.

## Playback Witness

- [verification.md](witness/verification.md) — automated test run.
- Acceptance tests prove topics are promoted after two captures
  share a keyword, and --json --topics emits topic events with
  name and thoughtCount.

## Drift

- Accidentally ran --enrich against live archive during playback.
  New policy: never touch live data — use test fixtures only.

## New Debt

- Stopword list needs tuning (common words like "even", "basically"
  slip through)
- No --enrich=<entryId> for single-entry enrichment yet
- No MCP enrich/topics tools yet

## Cool Ideas

- None.

## Backlog Maintenance

- [x] Done
