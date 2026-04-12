# HT-007 — Remediation Payloads in JSON Errors

Legend: [CORE — Core Bedrock](../../legends/CORE.md)

## Idea

When a non-interactive agent receives a `graph.migration_required` error in `--json` mode, it currently has to infer the fix. While the error is diagnostic, it requires the agent to manually construct and execute a separate command to proceed.

Update all machine-readable error responses to include an optional `remediation` field. For migration errors, this field should contain the exact CLI string (`think --migrate-graph`) required to resolve the lockout.

## Why

1. **Agentic Autonomy**: Allows AI agents to self-correct and recover from graph model evolutions without human intervention.
2. **Industrial-Grade DX**: Moves the API from "reporting failure" to "guiding recovery."
3. **Consistency**: Aligns with the "Agent-Human Parity" tenet by providing machine-actionable signals.

## Effort

Small — update the error response logic in the CLI and MCP service layers.
