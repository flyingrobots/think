# Capture-time auto-tagging

Attempt to tag or categorize a thought at capture time without
user input. Runs as part of the derivation follow-through (after
raw save, like seed quality scoring).

Approach:
- Extract topic keywords via lightweight NLP (no LLM required):
  TF-IDF against the existing corpus, or simple noun-phrase
  extraction
- Assign tags as a new derived artifact: `kind: 'auto_tags'` with
  `tags: ['performance', 'architecture', 'git-warp']`
- Tags are suggestions, not ground truth — the user can override
  or dismiss
- Keep the capture path sacred: tagging happens in follow-through,
  never blocking the raw save

The tag vocabulary grows organically from the corpus. No predefined
taxonomy — Think discovers your topics, it doesn't impose them.

**Superseded by:** `docs/design/enrichment-pipeline.md`
