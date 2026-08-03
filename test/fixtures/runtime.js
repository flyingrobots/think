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
 * Git environment variables that name *where* a repository lives.
 *
 * Git exports these to every hook, so a suite launched from the repo's own
 * pre-push hook inherits them and any git call that resolves its repository
 * from the environment silently targets the wrong one. Identity and transport
 * variables such as GIT_AUTHOR_NAME or GIT_SSH_COMMAND are deliberately not
 * listed: the product sets its own identity, and transport settings are safe to
 * inherit.
 */
export const GIT_LOCATION_ENV_VARS = Object.freeze([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CEILING_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_INDEX_VERSION',
  'GIT_NAMESPACE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
  'GIT_QUARANTINE_PATH',
  'GIT_WORK_TREE',
]);

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
  const gitLocation = new Set(GIT_LOCATION_ENV_VARS);

  return Object.fromEntries(
    Object.entries(processEnv).filter(
      ([key]) => !key.startsWith(THINK_ENV_PREFIX) && !gitLocation.has(key)
    )
  );
}

export function createHermeticThinkEnv({
  processEnv = process.env,
  baseEnv: base = baseEnv,
  extraEnv = {},
  homeDir,
  upstreamUrl,
}) {
  // Node omits env pairs whose value is undefined, so a forgotten homeDir would
  // leave HOME unset in the child. getHomeDir() falls back to os.homedir() and
  // the suite would quietly run against the developer's real ~/.think again.
  if (!homeDir) {
    throw new Error('createHermeticThinkEnv: homeDir is required to keep the suite off a real mind');
  }

  return {
    ...scrubThinkEnv(processEnv),
    ...base,
    ...extraEnv,
    HOME: homeDir,
    THINK_UPSTREAM_URL: upstreamUrl ?? '',
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
