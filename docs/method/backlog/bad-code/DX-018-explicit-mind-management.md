# DX-018 — Explicit Mind Management

Legend: [DX — Developer Experience](../../legends/DX-developer-experience.md)

## Idea

Current "Multi-Mind" support relies on ad-hoc directory discovery and manual repo switching via `THINK_REPO_DIR` environment variables. This makes it difficult for agents to isolate their cognitive archives without wrapper scripts.

Introduce an explicit `--mind=<name>` flag to the CLI and a corresponding `mind` parameter to MCP tools. When provided, Think should automatically resolve the path to `~/.think/<name>/` and bootstrap the repository if it doesn't exist. Consolidate all mind-resolution logic into a single `MindManager` class.

## Why

1. **Ergonomics**: Simplifies agent isolation (one flag vs. a wrapper script).
2. **Discoverability**: Allows the TUI and CLI to easily list and switch between available cognitive archives.
3. **Maintainability**: Removes ad-hoc path resolution spread across the store layer.

## Effort

Medium — requires refactoring path resolution in the store and updating CLI/MCP entry points.
