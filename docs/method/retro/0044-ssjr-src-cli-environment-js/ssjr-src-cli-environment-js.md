---
title: "SSJR for src/cli/environment.js"
cycle: "0044-ssjr-src-cli-environment-js"
outcome: hill-met
drift_check: yes
---

# Retro

Extracted isInteractiveShellAvailable shared helper. 5 functions
now delegate to it instead of duplicating the same check.
