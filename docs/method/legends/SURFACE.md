# SURFACE

All user-facing and agent-facing surfaces — CLI, MCP, macOS app, browse, inspect, ingress paths.

## What it covers

- CLI entry points and command dispatch (`think`, `think-mcp`)
- MCP server and typed tool registration
- macOS menu bar app, hotkey capture, URL-scheme ingress
- Browse and inspect read modes (TUI and JSON)
- Recent, remember, stats — all read commands
- Stdin ingest and future ingress surfaces
- Agent-native JSONL contract

## Who cares

Humans capturing thoughts. Agents using the MCP or CLI. Anyone reading back their archive.

## What success looks like

- CLI and MCP expose the same capture and read semantics — no second product.
- The macOS capture panel feels faster than opening a notes app.
- Browse helps navigation without becoming a dashboard.
- Agent surfaces are explicit, typed, and inspectable.
- Every ingress path uses the same core capture contract.

## How you know

- Acceptance tests cover every CLI command, MCP tool, and edge case.
- MCP tests verify round-trip capture → read through the typed tool surface.
- macOS Swift tests cover the capture panel, adapter, and URL routing.

## Historical milestones

- M2: macOS capture surface
- M4: Reentry, browse, and inspect
- M5: Additional ingress surfaces (ingest, URL capture, MCP)
