---
title: "Restrict provenance URL schemes"
cycle: "0014-audit-provenance-url-schemes"
outcome: hill-met
drift_check: yes
---

# Restrict provenance URL schemes Retro

## Summary

Added SAFE_URL_SCHEMES allowlist (http:, https:) to normalizeUrl.
Dangerous schemes (data:, file:, ftp:, javascript:) are now rejected.
Two new port tests.

## Drift

- None.
