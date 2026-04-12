# CI-002 — Auto-Mind Discovery in TUI

Legend: [CORE — Core Bedrock](../../legends/CORE.md)

## Idea

Think supports "Multiple Minds" by switching repositories, but discovery is currently manual.

Enhance the TUI splash screen and CLI to automatically scan the `~/.think/` directory for any subdirectory containing a valid Git repository. Provide a "Mind Switcher" overlay (summoned by `m`) that lists these minds and allows instantaneous context-switching within the same TUI session.

## Why

1. **Ergonomics**: Makes the multi-mind architecture accessible without needing to restart the application or set environment variables.
2. **Organization**: Encourages users to isolate different cognitive domains (e.g., `work`, `side-project`, `agentic-exploration`) while maintaining a single primary entry point.
3. **Productivity**: High-speed switching between archives is essential for multi-project developers.

## Effort

Small-Medium — requires a directory-walking utility and a TUI overlay component.
