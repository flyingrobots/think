---
title: "think --doctor"
legend: "CORE"
cycle: "0005-think-doctor"
source_backlog: "docs/method/backlog/cool-ideas/CORE_think-doctor.md"
---

# think --doctor

Source backlog item: `docs/method/backlog/cool-ideas/CORE_think-doctor.md`
Legend: CORE

## Sponsors

- Human: James
- Agent: Claude

## Hill

`think --doctor` reports the health of the local Think environment in
one command — repo status, graph version, entry count, upstream config,
and prompt metrics visibility.

## Playback Questions

### Human

- [ ] Can I run `think --doctor` and see at a glance if everything
      is healthy?
- [ ] Does it tell me what's wrong when something is broken?

### Agent

- [ ] Does `--json` output give a machine-readable health report?
- [ ] Does the MCP `doctor` tool return the same structured data?
- [ ] Does doctor work before the first capture (no repo yet)?
- [ ] Does doctor report upstream config without attempting a push?

## Accessibility and Assistive Reading

- Linear truth: each check is a labeled pass/fail line. No decoration
  required to understand the result.
- Non-visual: `--json` output is the primary agent surface.

## Localization and Directionality

- Not applicable — output is technical diagnostics, not user prose.

## Agent Inspectability and Explainability

- `--json` emits a `doctor.result` event with all checks as fields.
- MCP `doctor` tool returns the same structured object.
- Each check has a status (`ok`, `warn`, `fail`, `skip`) and a
  human-readable message.

## Non-goals

- No capture path write test (would create a real entry as a side effect)
- No MCP server launch test (would require spawning a process)
- No repair — doctor diagnoses, it doesn't fix
- No upstream connectivity test (would require network access)

## Design

### Checks

| Check | Status | Condition |
|-------|--------|-----------|
| Think directory | ok/fail | `~/.think/` exists |
| Local repo | ok/fail | `hasGitRepo(repoDir)` |
| Graph model | ok/warn/fail | version matches `GRAPH_MODEL_VERSION` |
| Entry count | ok/warn | `getStats()` total > 0, warn if 0 |
| Upstream | ok/skip | `THINK_UPSTREAM_URL` is configured or not |
| Prompt metrics | ok/skip | metrics file path exists or not |

### CLI text output

```
think doctor
  ✓ Think directory exists (~/.think)
  ✓ Local repo is a valid git repo
  ✓ Graph model is current (v3)
  ✓ 100 thoughts captured
  ○ Upstream not configured
  ○ Prompt metrics file not found
```

Symbols: `✓` ok, `!` warn, `✗` fail, `○` skip.

### CLI JSON output

```json
{"event":"doctor.result","checks":[
  {"name":"think_dir","status":"ok","message":"..."},
  {"name":"local_repo","status":"ok","message":"..."},
  ...
]}
```

### MCP tool

`doctor` tool with no required params. Returns the same checks array.

### Files to change

- `src/cli/options.js` — add `--doctor` flag
- `src/cli.js` — add `doctor` command dispatch
- `src/cli/commands/read.js` — add `runDoctor()`
- `src/doctor.js` — core diagnostic logic (pure, testable)
- `src/mcp/server.js` — register `doctor` tool
- `src/mcp/service.js` — add `checkThinkHealth()`
