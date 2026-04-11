# Doctor: extended health checks

Add graph model version and entry count checks to `runDiagnostics()`.

- **Graph model**: check `getGraphModelStatus()` — ok if current,
  warn if migration needed, fail if repo can't be read.
- **Entry count**: check `getStats()` total — ok if > 0, warn if 0.

Debt from cycle 0005-think-doctor.
