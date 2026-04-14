# Post-capture automated enrichment pipeline

Background enrichment that runs after capture (or on a schedule)
to annotate, link, categorize, and schedule thoughts for revisit.

## Pipeline stages

### 1. Topic extraction
Identify topics and themes from thought text. Store as derived
`auto_topics` artifact. Use corpus-relative frequency (TF-IDF) or
LLM extraction.

### 2. Semantic parsing
Parse for actionable structure:
- Questions ("how do I...") → mark as open question
- Decisions ("I decided to...") → mark as decision
- Tasks ("need to...") → mark as action item
- Observations ("I noticed...") → mark as observation
Store as `kind: 'semantic_parse'` artifact.

### 3. Auto-linking
Find similar thoughts in the archive by topic/embedding overlap.
Create `relates_to` edges between thoughts that share themes but
weren't captured in the same session. "You said something similar
3 weeks ago."

### 4. Auto-annotation
Generate a one-line summary or "gist" of each thought. Store as
`kind: 'auto_annotation'`. Useful for browse list views and search
results.

### 5. Revisit scheduling
Score thoughts for revisit priority based on:
- Age (older = more likely forgotten)
- Seed quality (reflectable thoughts worth revisiting)
- Topic activity (thoughts in active topics vs dormant ones)
- No prior annotations (un-enriched thoughts)
Store as `kind: 'revisit_score'` artifact.

## Architecture

All enrichment produces derived artifacts linked to the original
capture. Nothing mutates raw entries. Enrichment can re-run
idempotently — artifacts are keyed by (source_entry, enrichment_type,
version).

Two modes:
- **Inline**: runs during capture follow-through (lightweight only:
  topic extraction, semantic parse)
- **Background**: runs on a schedule or `think --enrich` command
  (heavier: auto-linking, LLM annotation, revisit scoring)

## LLM boundary

Lightweight enrichment (topics, semantic parse) should work without
an LLM — pattern matching and corpus statistics. LLM enrichment
(annotation, linking rationale) is opt-in and clearly marked in
provenance as LLM-derived.
