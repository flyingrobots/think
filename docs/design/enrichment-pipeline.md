# Enrichment Pipeline Design

A graph-native enrichment system for Think that models the pipeline
itself, its inputs, and its outputs as WARP graph nodes and edges.

## Principles

1. **Raw captures are immutable.** Enrichment never mutates a capture
   node. All enrichment produces new derived nodes linked to the
   original via named edges.
2. **The pipeline is in the graph.** Pipeline runs, stage results,
   and scheduling decisions are themselves WARP nodes — inspectable,
   versionable, and auditable.
3. **Provenance is explicit.** Every enrichment artifact records what
   produced it, what version of the enrichment logic ran, and what
   inputs it consumed.
4. **No LLM is required.** Lightweight enrichment (topics, semantic
   parse, linking) works without an LLM. LLM-assisted enrichment is
   opt-in, clearly marked, and separable.

---

## Graph Extension: New Node Types

### `artifact:<id>` (new kinds)

Enrichment artifacts use the existing `artifact:` prefix with new
`kind` values. Identity follows the established pattern:

```
artifactId = artifact:<sha256(kind + primaryInputId + discriminator + deriverVersion + schemaVersion)>
```

| Kind | Purpose | Primary Input | Discriminator |
|------|---------|---------------|---------------|
| `auto_tags` | Topic keywords extracted from text | `thought:<id>` | — |
| `semantic_parse` | Structural classification of content | `thought:<id>` | — |
| `auto_annotation` | One-line gist/summary of a thought | `thought:<id>` | — |
| `auto_link` | Detected similarity to another thought | `thought:<id>` | `relatedThoughtId` |
| `revisit_score` | Priority score for revisit scheduling | `entry:<id>` | — |
| `summary` | Aggregated digest of multiple entries | `pipeline_run:<id>` | — |

### `annotation:<sortKey-uuid>`

User-authored annotations on existing captures.

```
Properties:
  kind = 'annotation'
  source = 'annotation'
  channel = 'cli' | 'mcp' | 'tui'
  writerId = <author>
  createdAt = ISO timestamp
  sortKey = <timestamp-uuid>
  targetEntryId = entry:<id>  (what this annotates)
  text = <attached content>

Edge:
  annotation --annotates--> entry:<id>
```

### `link:<uuid>`

Explicit user-created relationship between two thoughts.

```
Properties:
  kind = 'link'
  source = 'link'
  writerId = <author>
  createdAt = ISO timestamp
  fromEntryId = entry:<id>
  toEntryId = entry:<id>
  linkType = 'relates_to' | 'contradicts' | 'extends' | 'replaces' | 'inspired_by'
  description = optional text

Edges:
  link --links_from--> entry:<from>
  link --links_to--> entry:<to>
```

### `evolution:<sortKey-uuid>`

A new thought with explicit lineage to an older one.

```
Properties:
  kind = 'evolution'
  source = 'evolution'
  writerId = <author>
  createdAt = ISO timestamp
  sortKey = <timestamp-uuid>
  seedEntryId = entry:<id>  (what this evolves from)
  text = <attached content>

Edges:
  evolution --evolves--> entry:<id>
  evolution --expresses--> thought:<fingerprint>  (same canonical pattern)
```

### `pipeline_run:<uuid>`

A record of an enrichment pipeline execution.

```
Properties:
  kind = 'pipeline_run'
  source = 'enrichment'
  writerId = <system>
  createdAt = ISO timestamp
  completedAt = ISO timestamp | null
  status = 'running' | 'completed' | 'failed'
  trigger = 'capture_followthrough' | 'scheduled' | 'manual'
  stagesRequested = JSON array of stage names
  stagesCompleted = JSON array of stage names
  targetEntryIds = JSON array of entry IDs processed
  errorMessage = null | string

Edges:
  pipeline_run --enriches--> entry:<id>  (one per target entry)
```

### `pipeline_stage:<uuid>`

A single stage's result within a pipeline run.

```
Properties:
  kind = 'pipeline_stage'
  source = 'enrichment'
  pipelineRunId = pipeline_run:<id>
  stageName = 'auto_tags' | 'semantic_parse' | 'auto_link' | 'auto_annotation' | 'revisit_score' | 'summary'
  status = 'completed' | 'failed' | 'skipped'
  targetEntryId = entry:<id>
  createdAt = ISO timestamp
  durationMs = number
  artifactIds = JSON array of artifact IDs produced
  errorMessage = null | string

Edges:
  pipeline_stage --produced_by--> pipeline_run:<id>
  pipeline_stage --targets--> entry:<id>
```

---

## Graph Extension: New Edge Labels

| Edge | From | To | Meaning |
|------|------|----|---------|
| `annotates` | annotation | entry | This annotation comments on this capture |
| `links_from` | link | entry | Source end of an explicit link |
| `links_to` | link | entry | Target end of an explicit link |
| `evolves` | evolution | entry | This thought evolved from that one |
| `enriches` | pipeline_run | entry | This pipeline run processed this entry |
| `produced_by` | pipeline_stage | pipeline_run | This stage belongs to this run |
| `targets` | pipeline_stage | entry | This stage processed this entry |
| `similar_to` | artifact (auto_link) | thought | Detected similarity |
| `summarizes` | artifact (summary) | entry | This summary covers this entry |

Existing edges (`derived_from`, `contextualizes`, `expresses`) are
reused where applicable.

---

## Pipeline Architecture

### Trigger Modes

1. **Capture follow-through** — runs inline after raw save, like
   `seed_quality` and `session_attribution` today. Only lightweight
   stages: `auto_tags`, `semantic_parse`.

2. **Manual** — `think --enrich` or `think --enrich=<entryId>`.
   Runs all stages on specified entries or un-enriched captures.

3. **Scheduled** — cron or idle-tick. Processes the backlog of
   un-enriched captures. Generates summaries at configurable
   intervals.

### Stage Dependency Graph

```
capture
  ↓ (follow-through)
  ├── auto_tags
  ├── semantic_parse
  ↓ (background)
  ├── auto_annotation  (needs: auto_tags)
  ├── auto_link        (needs: auto_tags, corpus index)
  ├── revisit_score    (needs: auto_tags, semantic_parse, age)
  ↓ (scheduled)
  └── summary          (needs: multiple entries, auto_tags)
```

### Stage Contracts

Each stage is a function:

```js
async function stageAutoTags(entry, context) {
  // Returns: { artifacts: [{ kind, properties, edges }], skipped: bool }
}
```

The pipeline runner:
1. Creates a `pipeline_run` node
2. For each stage in order:
   a. Creates a `pipeline_stage` node
   b. Calls the stage function
   c. Writes produced artifacts to the graph
   d. Updates stage status
3. Updates `pipeline_run` status

### Idempotency

Artifact IDs are deterministic (hash of kind + input + version).
Re-running a stage for the same input and version produces the same
artifact ID. The graph treats `addNode` on an existing ID as a
no-op, so re-runs are safe.

When the `deriverVersion` changes, a new artifact ID is generated
and both old and new coexist. Consumers read the latest version.

---

## Enrichment Stages

### 1. `auto_tags` (follow-through, no LLM)

Extract topic keywords from thought text using corpus-relative
frequency.

```
Artifact kind: 'auto_tags'
Properties:
  tags = JSON array of strings
  method = 'tf-idf' | 'noun-phrase' | 'keyword-extraction'

Edge:
  artifact --derived_from--> thought:<id>
```

Algorithm: TF-IDF against the existing corpus. Top N keywords
above a threshold. Falls back to simple noun-phrase extraction
if corpus is too small.

### 2. `semantic_parse` (follow-through, no LLM)

Classify the structural type of a thought.

```
Artifact kind: 'semantic_parse'
Properties:
  classification = 'question' | 'decision' | 'observation' | 'action_item' | 'idea' | 'reference' | 'unclassified'
  confidence = number (0-1)
  markers = JSON array of matched patterns

Edge:
  artifact --derived_from--> thought:<id>
```

Algorithm: Pattern matching on linguistic markers. "How do I..." →
question. "I decided to..." → decision. "Need to..." → action
item. Similar to existing `REFLECT_MARKERS` but broader.

### 3. `auto_annotation` (background, optional LLM)

Generate a one-line gist of a thought.

```
Artifact kind: 'auto_annotation'
Properties:
  gist = string (one sentence)
  method = 'extractive' | 'llm'
  llmModel = null | string (if LLM-generated)

Edge:
  artifact --derived_from--> thought:<id>
```

Without LLM: first sentence or first N words.
With LLM: one-sentence summary with explicit model provenance.

### 4. `auto_link` (background, no LLM)

Detect similar thoughts in the archive.

```
Artifact kind: 'auto_link'
Properties:
  relatedThoughtId = thought:<id>
  similarity = number (0-1)
  sharedTags = JSON array of common tags
  method = 'tag-overlap' | 'embedding-cosine'

Edges:
  artifact --derived_from--> thought:<source>
  artifact --similar_to--> thought:<related>
```

Algorithm: tag overlap from `auto_tags`. If embeddings are
available (opt-in), cosine similarity. Threshold for link
creation configurable.

### 5. `revisit_score` (background, no LLM)

Score a capture for revisit priority.

```
Artifact kind: 'revisit_score'
Properties:
  score = number (0-100)
  factors = JSON object { age, seedQuality, topicActivity, annotationCount }

Edge:
  artifact --contextualizes--> entry:<id>
```

Factors:
- Age: older thoughts score higher (exponential decay)
- Seed quality: `likely_reflectable` scores higher than `weak_note`
- Topic activity: thoughts in active topics score lower (already
  being worked on)
- Annotation count: un-annotated thoughts score higher

### 6. `summary` (scheduled, optional LLM)

Aggregate digest of a time period or topic.

```
Artifact kind: 'summary'
Properties:
  scope = 'session' | 'daily' | 'weekly' | 'monthly' | 'topic'
  scopeKey = session:<id> | '2026-04-11' | 'architecture'
  text = <attached content>
  entryCount = number
  method = 'deterministic' | 'llm'

Edges:
  artifact --summarizes--> entry:<id>  (one per source entry)
  artifact --produced_by--> pipeline_run:<id>
```

Without LLM: bullet list of entries grouped by topic/session,
with auto-annotation gists.
With LLM: narrative synthesis with explicit model provenance.

---

## CLI Surface

```bash
# Manual enrichment
think --enrich                     # enrich all un-enriched captures
think --enrich=<entryId>           # enrich a specific capture
think --enrich --stage=auto_tags   # run only one stage

# Annotations
think --annotate=<entryId> "my note"

# Links
think --link <id1> <id2> "because..."
think --link <id1> <id2> --type=extends

# Evolution
think --evolve=<entryId> "refined version of this idea"

# Revisit
think --revisit                    # surface a thought to revisit
think --revisit --since=30d

# Summaries
think --summarize --since=1d
think --summarize --session=<id>
think --summarize --topic=architecture

# Inspection
think --inspect=<entryId>          # now shows enrichment artifacts
```

### `--json` Output

All enrichment commands emit JSONL events following existing
conventions:

```json
{"event":"enrich.start","entryId":"entry:...","stages":["auto_tags","semantic_parse"]}
{"event":"enrich.stage.done","stage":"auto_tags","artifactId":"artifact:...","tags":["perf","warp"]}
{"event":"enrich.done","entryId":"entry:...","artifactsCreated":2}
```

---

## MCP Surface

New tools:

| Tool | Input | Output |
|------|-------|--------|
| `enrich` | `entryId?`, `stages?` | Pipeline run result |
| `annotate` | `entryId`, `text` | Annotation entry |
| `link` | `fromEntryId`, `toEntryId`, `type?`, `description?` | Link node |
| `evolve` | `entryId`, `text` | Evolution entry |
| `revisit` | `since?` | Entry to revisit |
| `summarize` | `scope`, `scopeKey?`, `since?` | Summary artifact |

---

## Browse TUI Surface

New panels and keys:

| Key | Action |
|-----|--------|
| `a` | Annotate current thought |
| `e` | Show enrichment panel (tags, parse, links, score) |
| `t` | Filter by tag |

The enrichment panel shows:
- Auto-tags as a tag bar
- Semantic classification badge
- Linked thoughts with descriptions
- Revisit score
- Annotations (chronological)
- Evolution chain (if any)

---

## Migration

### Graph Model Version 4

New edge labels and node kinds require a graph model version bump.
Migration from v3 → v4:

1. Add `pipeline_run`, `pipeline_stage`, `annotation`, `link`,
   `evolution` to the match lens
2. No existing data changes — enrichment is purely additive
3. Set `graphModelVersion = 4` on `meta:graph`

### Backfill

On first `--enrich` or scheduled run, the pipeline processes all
existing captures that lack enrichment artifacts. This is a one-time
catch-up, not a migration.

---

## Implementation Sequence

1. **Graph extension**: new constants, edge labels, node kinds,
   match lens update
2. **Annotate**: simplest enrichment — proves the derived-node
   pattern for user-authored content
3. **auto_tags + semantic_parse**: first automated stages, inline
   in follow-through
4. **Pipeline runner**: `pipeline_run` and `pipeline_stage` nodes,
   stage orchestration
5. **auto_link + auto_annotation**: background stages
6. **revisit_score + --revisit**: scheduling and re-encounter
7. **summary**: aggregation stage
8. **Link + Evolve**: explicit relationship types
9. **Browse enrichment panel**: TUI integration
10. **LLM opt-in**: annotation and summary with model provenance
