# Ambient context and recall behavior are underdocumented

The behavior that powers ambient capture context, remember scoring, and provenance flow is spread across `src/project-context.js`, `src/store/capture.js`, `src/store/queries.js`, and `src/capture-provenance.js`.

There is no single contributor-facing doc that explains what gets collected, when it gets normalized, and how it affects recall. That makes the behavior harder to change safely.
