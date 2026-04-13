# Ambient Context and Recall

How Think collects, persists, and uses project context for capture
provenance and recall matching.

## Overview

When a thought is captured, Think records the ambient project context
— the working directory, git remote, branch, and derived project
tokens — alongside the raw text. This context powers `--remember`,
which matches prior thoughts by project affinity rather than requiring
explicit search terms.

## Collection

Two levels of context are collected at different points in the capture
flow:

### Capture ambient context (`getCaptureAmbientContext`)

Collected synchronously during `saveRawCapture`. Cheap — no git
probes.

| Field | Source | Notes |
|-------|--------|-------|
| `cwd` | `path.resolve(cwd)` | Resolved working directory |
| `projectName` | Derived from cwd basename | Fallback when no git |
| `projectTokens` | Derived from projectName | Lowercased, split on non-alphanumeric |

### Full ambient context (`getAmbientProjectContext`)

Collected during `finalizeCapturedThought` follow-through. Runs three
`git` probes via `spawnSync`:

| Field | Git command | Notes |
|-------|-------------|-------|
| `gitRoot` | `rev-parse --show-toplevel` | Absolute path to repo root |
| `gitRemote` | `config --get remote.origin.url` | Origin remote URL |
| `gitBranch` | `branch --show-current` | Current branch name |
| `projectName` | Derived from gitRemote → gitRoot → cwd | Priority order |
| `projectTokens` | All candidates, lowercased, split | Used for recall matching |

### Resolution priority

The `projectName` is derived in priority order:
1. Last segment of `gitRemote` URL (sans `.git`)
2. Basename of `gitRoot`
3. Basename of `cwd`

### Where resolution happens

The CLI and MCP layers resolve ambient context at the boundary
(`process.cwd()`) and pass it into the store functions. The store
layer does not read `process.cwd()` or shell out to git directly.

## Persistence

Context fields are stored as WARP node properties on the entry:

| Property | Source |
|----------|--------|
| `ambientCwd` | `cwd` |
| `ambientGitRoot` | `gitRoot` (follow-through only) |
| `ambientGitRemote` | `gitRemote` (follow-through only) |
| `ambientGitBranch` | `gitBranch` (follow-through only) |

The two-phase write means `ambientCwd` is available immediately after
capture, while git fields are backfilled during follow-through. This
preserves capture latency.

## Recall matching (`--remember`)

### Ambient recall (no query)

`buildAmbientRememberScope(cwd)` resolves the current project context
and matches stored entries by affinity:

| Match kind | Condition | Score | Tier |
|------------|-----------|-------|------|
| `ambient_git_remote` | Entry's `ambientGitRemote` matches current | 100 | 3 |
| `ambient_git_root` | Entry's `ambientGitRoot` matches current | 50 | 3 |
| `ambient_cwd` | Entry's `ambientCwd` matches current | 25 | 3 |
| `ambient_git_branch` | Entry's `ambientGitBranch` matches current | 15 | 3 |
| `project_tokens_text` | Entry text contains any current project token | 5 per token | 3 |

Results are sorted by score (highest first), then by recency.

### Explicit recall (with query)

`buildExplicitRememberScope(query)` splits the query into terms and
matches against entry text. Terms are lowercased and split on
non-alphanumeric boundaries.

| Match kind | Condition | Score |
|------------|-----------|-------|
| `query_terms` | Entry text contains query terms | 1 per term |

### Provenance

Capture provenance (`CaptureProvenance`) is separate from ambient
context. It records how the thought entered the system:

| Field | Source | Values |
|-------|--------|--------|
| `ingress` | Capture surface | `url`, `shortcut`, `selected_text`, `share` |
| `sourceApp` | Originating application | Free text (trimmed) |
| `sourceURL` | Source URL | `http:` or `https:` only |

Provenance is normalized at the boundary via
`normalizeCaptureProvenance` and persisted as entry properties
(`captureIngress`, `captureSourceApp`, `captureSourceURL`).

## Files

| File | Role |
|------|------|
| `src/project-context.js` | Collection and token generation |
| `src/capture-provenance.js` | Provenance normalization |
| `src/store/capture.js` | Persistence (saveRawCapture, finalize) |
| `src/store/remember.js` | Recall scope and matching |
| `src/store/queries.js` | Query execution (rememberThoughts) |
