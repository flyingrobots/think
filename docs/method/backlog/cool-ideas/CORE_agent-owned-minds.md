# Agent-owned minds

Agents may need their own thought repo rather than writing into the
operator's personal mind. Preserves separate provenance and avoids
polluting a human's private archive.

Each agent (Claude, Codex, Gemini) gets a named mind under
`~/.think/<agent>/`. The agent captures into its own mind via
`--mind=<name>` or `THINK_REPO_DIR`. The human can browse any
agent's mind through the TUI mind switcher.

Dropped from the original CORE_multiple-minds backlog item when
cycle 0004 scoped down to browse-only mind switching.
