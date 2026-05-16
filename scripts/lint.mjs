#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const forwardedArgs = process.argv.slice(2);

const eslintStatus = runChecked('eslint', ['.', ...forwardedArgs]);
if (eslintStatus !== 0) {
  process.exit(eslintStatus);
}

process.exit(runChecked(process.execPath, ['./scripts/runtime-truth-ratchet.mjs']));

function runChecked(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    process.stderr.write(`${command} failed: ${result.error.message}\n`);
    return 1;
  }
  if (result.signal) {
    process.stderr.write(`${command} exited via signal ${result.signal}\n`);
    return 1;
  }

  return result.status ?? 1;
}
