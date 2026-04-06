import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line no-shadow -- ESM shim for __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, '../..');
export const cliEntrypoint = path.join(repoRoot, 'bin', 'think.js');

export const baseEnv = {
  LANG: 'C',
  LC_ALL: 'C',
  NO_COLOR: '1',
  TERM: 'dumb',
};

export function formatResult(result) {
  const pieces = [
    `exit status: ${result.status}`,
    `signal: ${result.signal ?? 'none'}`,
    'stdout:',
    result.stdout || '(empty)',
    'stderr:',
    result.stderr || '(empty)',
  ];

  return pieces.join('\n');
}

export function requireCliEntrypoint() {
  assert.ok(
    existsSync(cliEntrypoint),
    [
      'Milestone 1 acceptance tests require a CLI entrypoint.',
      `Expected file: ${cliEntrypoint}`,
      'Implement the CLI before expecting these tests to pass.',
    ].join('\n')
  );
}
