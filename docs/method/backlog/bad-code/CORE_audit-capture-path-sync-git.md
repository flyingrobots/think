# Capture path still shells out to `git` synchronously

`saveRawCapture()` calls `getAmbientProjectContext(process.cwd())`, and that helper runs three `spawnSync('git', ...)` probes.

The capture path is supposed to be sacred. This host work belongs behind a bounded adapter or cache, not inline in persistence.
