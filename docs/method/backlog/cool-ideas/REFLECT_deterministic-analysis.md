# Deterministic analysis surfaces

A family of non-LLM analysis ideas. All should stay explainable and deterministic.

## Session buckets

Group captures by temporal proximity to create honest "human session" structure. Possible rule: same session if captured within 5 minutes. Good for reflection packs, replay artifacts, cluster disambiguation, brainstorm candidate selection.

## Multi-signal similarity graph

Build a deterministic graph using more than lexical overlap alone: TF-IDF or BM25-style lexical similarity, temporal session proximity, explicit brainstorm or reflection linkage. Important: do not claim this is "meaning" — present it as structural nearness with receipts.

## Community detection

Run Louvain or Leiden-style community detection over the similarity graph. Possible uses: x-ray neighborhoods, reflection packs, cluster-level replay. Keep the cluster explanation inspectable. Never silently inject cluster meaning into capture or recent.

## Keyphrase receipts

Use deterministic keyphrase extraction (TextRank) to surface reflective handles. Good for weekly or cluster-level reflection receipts. Bad for pretending to summarize the user's mind. The system should say "here are the statistical handles", not "here is what your week meant."

## Cluster-aware novelty and stability metrics

Track how an inferred thread changes over time without pretending adjacent edit distance is idea evolution. Better signals: keyword turnover, novelty of high-weight terms, re-entry cadence, distance from cluster centroid, activity over time.

## Structural receipts

Whenever later modes expose a cluster or link, show why it exists: shared unusual terms, same session bucket, explicit brainstorm linkage. Must stay explainable and deterministic.

## Do not promote early

- Raw adjacent-entry Levenshtein drift as the main evolution metric.
- Lexical-only clustering presented as "understanding."
- Silent classification leaking into capture or recent.
