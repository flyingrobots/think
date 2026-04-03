# Why do we fall, Bruce?

So we can `retry({ backoff: 'exponential', jitter: 'decorrelated' })`.

Think already uses Alfred for the upstream backup push path (`git.js`). There's room to use it more broadly:

- **MCP capture service** — wrap WARP graph writes with `Policy.timeout()` + `Policy.retry()` so transient graph hiccups don't kill captures
- **Named policy composition** — replace the inline retry/timeout in `git.js` with a composed, reusable Alfred policy
- **MCP health circuit** — `Policy.circuitBreaker()` around the MCP transport on the Node side, so sustained failures trip the breaker and surface honestly instead of burning retries

The Swift-side auto-restart (SURFACE_mcp-process-auto-restart) implements the same retry+backoff pattern manually since Alfred is JS-only. The Node side should use Alfred directly.
