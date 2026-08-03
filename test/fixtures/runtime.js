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

export const THINK_ENV_PREFIX = 'THINK_';

/**
 * Build a hermetic environment for a spawned Think process.
 *
 * Pinning HOME is not enough on its own. `getLocalRepoDir` honours
 * THINK_REPO_DIR ahead of $HOME/.think/repo, and `getPromptMetricsFile` and
 * `captureProvenanceFromEnvironment` read their own THINK_ variables, so an
 * inherited environment can redirect the suite at a developer's real mind and
 * write test captures into it.
 *
 * Every inherited THINK_ variable is therefore dropped. The scrub is
 * prefix-wide rather than an allowlist so a newly added knob cannot quietly
 * reopen the hole. Fixtures and individual tests can still set THINK_
 * variables deliberately through `baseEnv` and `extraEnv`, which are layered
 * on after the scrub.
 */
export function scrubThinkEnv(processEnv = process.env) {
  return Object.fromEntries(
    Object.entries(processEnv).filter(([key]) => !key.startsWith(THINK_ENV_PREFIX))
  );
}

export function createHermeticThinkEnv({
  processEnv = process.env,
  baseEnv: base = baseEnv,
  extraEnv = {},
  homeDir,
  upstreamUrl,
}) {
  return {
    ...scrubThinkEnv(processEnv),
    ...base,
    ...extraEnv,
    HOME: homeDir,
    THINK_UPSTREAM_URL: upstreamUrl,
  };
}

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
