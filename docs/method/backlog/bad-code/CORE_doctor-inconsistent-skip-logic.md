# Doctor checks have inconsistent skip logic

Graph model and entry count checks skip when `repoOk` is false OR
callback is missing. But upstream reports "ok" when URL is set but
no `checkUpstreamReachable` callback is provided — giving false
confidence that the upstream was validated.

Standardize: all checks should skip if they lack the means to verify.

File: `src/doctor.js`
