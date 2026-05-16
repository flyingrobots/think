---
id: CORE_mcp-service-dependency-injection
blocks: []
blocked_by:
  - CORE_hexagonal-store-boundary
---

# MCP service is a composition root instead of an injected service

`src/mcp/service.js` imports paths, Git operations, policies, project
context, and store functions directly. `src/mcp/server.js` imports those
service functions and registers them with concrete MCP transport
schemas.

This makes the MCP surface hard to instantiate with alternate storage,
alternate project context, or non-Node hosts.

## Acceptance Criteria

- Introduce a `ThinkMcpService` or equivalent runtime-backed service
  class.
- The service constructor receives capture, read, migration, health,
  backup, path, and project-context ports.
- `src/mcp/server.js` owns Zod schemas and MCP registration only.
- Wire input is decoded at the MCP boundary and normalized before it
  enters the service.
- Tests can instantiate the MCP service with in-memory ports and no
  process globals.
