# Mind-switch loop embedded in command layer

The mind-switching orchestration (re-bootstrap, re-open graph store,
re-create loaders) is hardcoded inside `runInteractiveBrowseShell()`.
If mind switching is needed in other contexts (API, non-interactive),
the entire loop structure would need duplication.

Neither `runBrowseTui()` nor the caller owns the switching cleanly.

File: `src/cli/commands/read.js` (lines 493-575)
