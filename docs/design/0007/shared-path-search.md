# 0007 Shared Path Search

Status: implemented and closed

## Sponsor

Primary sponsor human:

- a maintainer working on the macOS capture adapter who should only have to change one path-resolution algorithm when repo layout assumptions change

Primary sponsor agent:

- an agent modifying either CLI or MCP resolver code that should not have to rediscover and re-edit duplicated upward-search logic in parallel files

## Hill

If the macOS capture adapter needs to locate either `bin/think.js` or `bin/think-mcp.js`, both resolvers rely on one shared search utility with the same explicit search-root and upward-walk behavior, and the Swift tests cover both paths clearly.

## Purpose

This slice removes duplicated path-search logic in the macOS capture adapter.

Today:

- `ThinkCLICommandResolver` and `ThinkMCPCommandResolver` each implement the same search-root construction
- each resolver separately walks parent directories looking for a bin script
- only the CLI resolver behavior is explicitly tested

That duplication is small, but it is still debt:

- changes must be repeated
- future divergence is easy
- MCP path resolution is less directly covered than CLI path resolution

## Problem

The two resolver files differ mostly by:

- explicit environment key
- script name
- transport/command wrapper
- final failure message

The actual search algorithm is copy-pasted.

This makes a simple path-policy change more expensive than it should be and weakens confidence that both surfaces behave the same way.

## Slice Lock

Implemented in this slice:

- extract a shared path-search utility for the resolver algorithm
- keep explicit env-var overrides and repo-root overrides intact
- add Swift tests that directly cover both CLI and MCP resolution behavior

Deferred from this slice:

- changing repo layout assumptions
- broad adapter architecture changes
- settings or operator UX around resolver behavior
- any change to capture semantics

## Design Decision

Introduce a small shared utility in `ThinkCaptureAdapter` that owns:

- search-root deduplication
- upward parent traversal
- candidate path construction for a named bin script

Both resolvers should keep their boundary-specific decisions:

- which env var is authoritative
- which script name is required
- how the resolved path is wrapped into a command/transport
- the final error message

The shared utility should remain narrow and factual. It exists to remove duplication, not to invent a new abstraction hierarchy.

## Playback Checks

### Agent perspective

1. Is the upward-search algorithm defined once?  
2. Do both resolvers still support explicit env-var overrides and `THINK_REPO_ROOT` overrides?  
3. Are there direct tests for both CLI and MCP resolution paths?  

### Human perspective

1. Can a maintainer understand the resolver search policy from one utility plus two thin wrappers?  
2. Is the slice visibly narrow, with no change to capture behavior?  

## Non-goals

- changing the capture path
- changing Node process launch behavior
- introducing a settings surface
- broad Swift package cleanup beyond the duplicated search logic
