# MCP service layer still shuffles raw objects

`src/mcp/service.js` is already called out in `docs/BEARING.md` as shape-soup debt, and the audit agrees. It mostly normalizes inputs, calls store functions, and returns anonymous result bags.

That is acceptable for a tiny adapter, but this one is now large enough to deserve explicit request and result forms.
