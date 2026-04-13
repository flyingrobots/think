# Release Readiness Runbook

Sequential pre-flight checks before tagging a release.

## Pre-flight

1. `npm run lint` — zero errors, zero warnings
2. `npm run test:ports` — all port tests pass
3. `npm run test:m1` — all acceptance tests pass
4. `npm run test:m2` — macOS Swift tests pass (Darwin only)
5. `node bin/think.js --doctor` — all checks ok/skip
6. `node bin/think.js --stats` — verify capture count is sane
7. Verify MCP tools list: `node -e "import('./src/mcp/server.js').then(m => m.createThinkMcpServer()).then(s => s.listTools()).then(t => console.log(t.tools.map(x=>x.name)))"`

## Release

1. Bump version in `package.json`
2. Date the CHANGELOG section
3. Commit: `chore: bump version to X.Y.Z`
4. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z — description"`
5. Push: `git push origin main --tags`
