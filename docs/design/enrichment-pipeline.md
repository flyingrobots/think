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
3. **Semantic objects are graph nodes.** Topics, classifications,
   and entity types are first-class nodes, not properties buried
   in JSON. Finding "thoughts about X" is a graph traversal, not
   a table scan.
4. **Provenance is explicit.** Every enrichment artifact records what
   produced it, what version of the enrichment logic ran, and what
   inputs it consumed.
5. **No LLM is required.** Lightweight enrichment (topics, semantic
   parse, linking) works without an LLM. LLM-assisted enrichment is
   opt-in, clearly marked, and separable.

---

## Graph Extension: Semantic Object Nodes

Semantic objects are first-class graph nodes. This means "find all
thoughts about performance" is `traverse incoming edges of
topic:performance` — not a scan of every artifact's JSON properties.

### Thought-level vs entry-level enrichment

Think has two identity layers:

- **Entry** (`entry:<id>`) — the capture *event*. Unique per capture.
  Two identical texts produce two entries.
- **Thought** (`thought:<fingerprint>`) — the canonical *content*.
  Two identical texts produce one thought.

Semantic enrichment operates on **thoughts** (content-level):
`thought --about--> topic`, `thought --classified_as--> classification`.
This means deduplication is automatic — identical captures don't
produce duplicate topic edges.

User-authored enrichment operates on **entries** (event-level):
`annotation --annotates--> entry`, `evolution --evolves--> entry`.
This means you can annotate one specific capture without affecting
other captures of the same text.

The bridge is the existing `expresses` edge:
`entry --expresses--> thought --about--> topic`.

### `topic:<normalized-name>`

A topic that thoughts can be about. Topics have a **promotion
threshold** — a topic candidate only becomes a graph node after it
appears across N thoughts (default: 2). Below the threshold, topic
candidates live as properties on the `auto_tags` receipt artifact.

```
Properties:
  kind = 'topic'
  name = 'performance'        (display name)
  normalizedName = 'performance'  (lowercase, deduplication key)
  createdAt = ISO timestamp
  source = 'auto_tags' | 'user'  (who created it)
  mentionCount = number         (how many thoughts reference this)

Edge:
  thought --about--> topic:performance
```

Identity: `topic:<normalizedName>`. Deterministic — same topic name
always resolves to the same node.

**Promotion**: the `auto_tags` stage tracks candidate counts. When a
candidate crosses the threshold, the stage creates the topic node
and backfills `about` edges for all prior thoughts that mentioned it.

**Merging / aliases**: topics can be merged. A `topic --alias_of-->
topic` edge redirects queries. `think --merge-topics perf performance`
moves all `about` edges from `topic:perf` to `topic:performance` and
adds the alias edge.

Finding all thoughts about a topic:

```
graph.query()
  .match('topic:performance')
  .traverse({ direction: 'incoming', label: 'about' })
  .run()
```

### `classification:<name>`

A semantic type that thoughts can be classified as. Finite set,
created at graph model v4 migration. A thought can have **multiple**
`classified_as` edges (e.g., both a question and an action item).

```
Nodes:
  classification:question
  classification:decision
  classification:observation
  classification:action_item
  classification:idea
  classification:reference
  classification:unclassified

Properties:
  kind = 'classification'
  name = 'question'

Edge:
  thought --classified_as--> classification:question
  thought --classified_as--> classification:action_item  (multi-class)
```

All thoughts get at least one `classified_as` edge. Thoughts that
don't match any pattern get `classification:unclassified` so they're
still reachable in the graph.

Finding all questions:

```
graph.query()
  .match('classification:question')
  .traverse({ direction: 'incoming', label: 'classified_as' })
  .run()
```

### `entity:<type>:<normalized-name>`

Named entities extracted from thought text — people, projects,
tools, concepts.

**This is a separate opt-in stage**, not bundled with
`semantic_parse`. Entity extraction on short informal text is
unreliable without an LLM. Classifying "is this a question?" is
cheap pattern matching; extracting "this mentions git-warp" is NER
and requires more confidence.

```
Examples:
  entity:project:git-warp
  entity:tool:bijou
  entity:person:james
  entity:concept:capture-latency

Properties:
  kind = 'entity'
  entityType = 'project' | 'tool' | 'person' | 'concept'
  name = 'git-warp'
  normalizedName = 'git-warp'
  createdAt = ISO timestamp

Edge:
  thought --mentions--> entity:project:git-warp
```

Finding all thoughts that mention git-warp:

```
graph.query()
  .match('entity:project:git-warp')
  .traverse({ direction: 'incoming', label: 'mentions' })
  .run()
```

### Cross-semantic traversal

Because topics, classifications, and entities are all nodes with
edges, you can compose queries:

- "All questions about performance":
  `topic:performance <--about-- thought --classified_as--> classification:question`

- "All thoughts mentioning git-warp in the last week":
  `entity:project:git-warp <--mentions-- thought` filtered by
  `createdAt`

- "Topics I haven't thought about in 30 days":
  `topic:* <--about-- thought` where latest thought's `createdAt`
  is older than 30 days

---

## Graph Extension: Enrichment Artifact Nodes

### `artifact:<id>` (new kinds)

Enrichment artifacts use the existing `artifact:` prefix with new
`kind` values. Identity follows the established pattern:

```
artifactId = artifact:<sha256(kind + primaryInputId + discriminator + deriverVersion + schemaVersion)>
```

| Kind | Purpose | Primary Input | Discriminator |
|------|---------|---------------|---------------|
| `auto_tags` | Tag extraction run receipt | `thought:<id>` | — |
| `semantic_parse` | Classification run receipt | `thought:<id>` | — |
| `auto_annotation` | One-line gist/summary of a thought | `thought:<id>` | — |
| `auto_link` | Detected similarity to another thought | `thought:<id>` | `relatedThoughtId` |
| `revisit_score` | Priority score for revisit scheduling | `entry:<id>` | — |
| `summary` | Aggregated digest of multiple entries | `pipeline_run:<id>` | — |

Note: `auto_tags` and `semantic_parse` artifacts are *receipts* of
the enrichment run. The actual semantic data lives on the topic and
classification nodes and their edges. The artifact records what was
extracted, when, and by what version — so re-runs can detect drift.

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

A single node per enrichment execution. Stage results are properties
on the run node, not separate nodes — this avoids 2N metadata nodes
for N thoughts.

```
Properties:
  kind = 'pipeline_run'
  source = 'enrichment'
  writerId = <system>
  createdAt = ISO timestamp
  completedAt = ISO timestamp | null
  status = 'running' | 'completed' | 'failed'
  trigger = 'capture_followthrough' | 'scheduled' | 'manual'
  stagesJson = JSON { stageName: { status, durationMs, artifactCount, error } }
  targetEntryCount = number
  errorMessage = null | string

Edges:
  pipeline_run --enriches--> entry:<id>  (one per target entry)
```

Stage-level detail lives in `stagesJson` instead of as separate
nodes. This keeps the graph focused on content relationships.
Pipeline runs are audit records — queryable but not the primary
navigation surface.

---

## Graph Extension: New Edge Labels

### Semantic edges (traversable for queries)

| Edge | From | To | Meaning |
|------|------|----|---------|
| `about` | thought | topic | This thought is about this topic |
| `classified_as` | thought | classification | This thought is this type |
| `mentions` | thought | entity | This thought mentions this entity |

### Enrichment edges

| Edge | From | To | Meaning |
|------|------|----|---------|
| `annotates` | annotation | entry | This annotation comments on this capture |
| `links_from` | link | entry | Source end of an explicit link |
| `links_to` | link | entry | Target end of an explicit link |
| `evolves` | evolution | entry | This thought evolved from that one |
| `similar_to` | artifact (auto_link) | thought | Detected similarity |
| `summarizes` | artifact (summary) | entry | This summary covers this entry |
| `covers` | artifact (summary) | topic | This summary covers this topic |

### Pipeline and topic management edges

| Edge | From | To | Meaning |
|------|------|----|---------|
| `enriches` | pipeline_run | entry | This pipeline run processed this entry |
| `alias_of` | topic | topic | This topic is a synonym of that topic |

Existing edges (`derived_from`, `contextualizes`, `expresses`) are
reused where applicable.

### Query patterns enabled by semantic nodes

```
# All thoughts about a topic
topic:performance <--about-- thought:*

# All questions
classification:question <--classified_as-- thought:*

# All thoughts mentioning a project
entity:project:git-warp <--mentions-- thought:*

# Questions about performance
topic:performance <--about-- thought --classified_as--> classification:question

# Topics covered by a summary
summary --covers--> topic:*

# Dormant topics (no recent thoughts)
topic:* <--about-- thought  (where latest createdAt > 30d ago)

# Related thoughts via shared topics
thought:A --about--> topic:X <--about-- thought:B

# Evolution chain
entry:newest --evolves--> entry:older --evolves--> entry:oldest
```

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
  ↓ (follow-through, no LLM)
  ├── auto_tags         → creates topic nodes + about edges
  ├── semantic_parse    → creates classified_as edges
  ↓ (background, no LLM)
  ├── auto_annotation   (needs: auto_tags)
  ├── auto_link         (needs: auto_tags, corpus)
  ├── revisit_score     (needs: auto_tags, semantic_parse, age)
  ↓ (opt-in, needs LLM)
  ├── entity_extraction → creates entity nodes + mentions edges
  ↓ (scheduled)
  └── summary           (needs: multiple entries, auto_tags)
```

Entity extraction is a separate opt-in stage, not bundled with
semantic_parse. Classifying "is this a question?" is cheap pattern
matching. Extracting "this mentions git-warp" is NER on informal
text and needs higher confidence (LLM or curated dictionary).

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

Extract topic keywords and create/link topic graph nodes.

**Graph mutations:**
1. For each extracted topic, ensure `topic:<name>` node exists
2. Add `about` edge from `thought:<id>` to each `topic:<name>`
3. Create `auto_tags` artifact as a receipt of the extraction

```
Receipt artifact kind: 'auto_tags'
Properties:
  topicsExtracted = JSON array of topic names
  method = 'tf-idf' | 'noun-phrase' | 'keyword-extraction'
  topicNodesCreated = number (new topics added to graph)

Edges:
  thought --about--> topic:<name>          (one per extracted topic)
  artifact --derived_from--> thought:<id>  (receipt provenance)
```

Algorithm: TF-IDF against the existing corpus. Top N keywords
above a threshold. Falls back to simple noun-phrase extraction
if corpus is too small.

### 2. `semantic_parse` (follow-through, no LLM)

Classify the structural type and link to classification nodes.
A thought can receive **multiple** `classified_as` edges.

**Graph mutations:**
1. Add `classified_as` edge(s) from `thought:<id>` to matching
   `classification:<type>` node(s)
2. If no pattern matches, add `classified_as` edge to
   `classification:unclassified`
3. Create `semantic_parse` artifact as a receipt

```
Receipt artifact kind: 'semantic_parse'
Properties:
  classifications = JSON array of matched types
  confidence = JSON object { type: score }
  markers = JSON array of matched patterns

Edges:
  thought --classified_as--> classification:<type>  (one or more)
  artifact --derived_from--> thought:<id>
```

Algorithm: Pattern matching on linguistic markers. "How do I..." →
question. "I decided to..." → decision. "Need to..." → action
item. Similar to existing `REFLECT_MARKERS` but broader. Multiple
patterns can match the same thought.

### 2b. `entity_extraction` (opt-in, needs LLM or dictionary)

Extract named entities and create entity graph nodes. **Separate
stage** from `semantic_parse` — requires higher confidence.

**Graph mutations:**
1. For each extracted entity, ensure `entity:<type>:<name>` node
   exists
2. Add `mentions` edge from `thought:<id>` to each entity

```
Receipt artifact kind: 'entity_extraction'
Properties:
  entitiesExtracted = JSON array of { type, name, entityId }
  method = 'llm' | 'dictionary' | 'pattern'
  llmModel = null | string

Edges:
  thought --mentions--> entity:<type>:<name>
  artifact --derived_from--> thought:<id>
```

Approaches (in order of reliability):
- **Dictionary**: curated list of known projects, tools, people.
  High precision, no coverage for new entities.
- **Pattern**: regex for common formats (GitHub URLs → project,
  `@mentions` → person). Medium precision.
- **LLM**: full NER with explicit model provenance. Best coverage,
  requires opt-in.

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

# Semantic queries (graph traversal)
think --topics                     # list all topics with thought counts
think --topic=performance          # list thoughts about performance
think --questions                  # list all thoughts classified as questions
think --about=architecture         # alias for --topic
think --mentions=git-warp          # list thoughts mentioning an entity

# Topic management
think --merge-topics perf performance  # merge perf into performance

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

New edge labels, node kinds, and semantic object nodes require a
graph model version bump. Migration from v3 → v4:

1. Add new prefixes to the match lens:
   - `topic:*`
   - `classification:*`
   - `entity:*`
   - `annotation:*`
   - `link:*`
   - `evolution:*`
   - `pipeline_run:*`
2. Create the 7 standing `classification:*` nodes (question,
   decision, observation, action_item, idea, reference,
   unclassified)
3. No existing data changes — enrichment is purely additive
4. Set `graphModelVersion = 4` on `meta:graph`

### Backfill

On first `--enrich` or scheduled run, the pipeline processes all
existing captures that lack enrichment artifacts. This is a one-time
catch-up, not a migration.

---

## Implementation Sequence

1. **Graph v4 migration**: new constants, edge labels, node kinds,
   match lens, standing classification nodes
2. **Annotate**: simplest enrichment — proves the derived-node
   pattern for user-authored content
3. **auto_tags**: topic node creation with promotion threshold,
   `about` edges, corpus-relative extraction
4. **semantic_parse**: classification edges, multi-class support,
   pattern-based
5. **Pipeline runner**: `pipeline_run` nodes, stage orchestration,
   idempotent re-runs
6. **auto_link + auto_annotation**: background stages
7. **revisit_score + --revisit**: scheduling and re-encounter
8. **summary**: aggregation stage with `covers` edges to topics
9. **Link + Evolve**: explicit user-authored relationship types
10. **Topic management**: merge, alias, prune dormant topics
11. **entity_extraction**: opt-in NER with dictionary/LLM backends
12. **Browse enrichment panel**: TUI integration (tags, class,
    links, annotations, evolution chain)
13. **LLM opt-in**: entity extraction, richer annotations and
    summaries with model provenance
