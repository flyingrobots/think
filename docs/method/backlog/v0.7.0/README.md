# v0.7.0 — Minds, doctor, and hardening

Theme: multi-mind browsing, operational health, and quality-of-life
improvements. No new capture-path features.

## Already shipped (this session, on main)

1. **Sparklines in stats** — `--stats --bucket=day` shows capture
   frequency sparkline. CLI text, JSON, and MCP formatted output.
2. **think --doctor** — health check command (think dir, local repo,
   upstream config). CLI text + JSON.
3. **Multiple minds** — `discoverMinds()` + `shaderForMind()` core,
   splash mind cycling with per-mind shaders, browse `m` key mind
   switcher. Blocked on bijou 4.4.1 theme fix for visual correctness.
4. **Splash dead code cleanup** — removed unused `renderSplashView`.
5. **BG_TOKEN consolidation** — moved to `style.js`.
6. **Bijou 4.4.0 upgrade** — zero-alloc frame chrome, input validation.

## Remaining for release

7. **Bijou 4.4.1 upgrade** — theme bg fill fix (once shipped).
   Unblocks TUI visual correctness for minds + browse.
8. **MCP doctor tool** — wire `runDiagnostics` into the MCP server
   as a `doctor` tool. Debt from cycle 0005.
9. **Doctor: graph model + entry count checks** — extend
   `runDiagnostics` to check graph version and total entries. Debt
   from cycle 0005.

## Stretch (pull if time permits)

10. **Upstream provisioning** — from up-next
    (`CORE_improve-upstream-provisioning`). Backup reliability.

## Critical path

```
bijou 4.4.1 fix → upgrade → verify TUI theme → release
                                              ↑
MCP doctor tool ─────────────────────────────┘
Doctor extended checks ──────────────────────┘
```
