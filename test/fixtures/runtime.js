import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
 * Repository-scoping git variables that are not in `git rev-parse
 * --local-env-vars` but still redirect lookups.
 */
const GIT_EXTRA_SCRUBBED_ENV_VARS = Object.freeze([
  'GIT_CEILING_DIRECTORIES',
  'GIT_INDEX_VERSION',
  'GIT_NAMESPACE',
  'GIT_QUARANTINE_PATH',
]);

/**
 * Git environment variables that bind a process to a specific repository.
 *
 * Git exports these to every hook, so a suite launched from the repo's own
 * pre-push hook inherits them and any git call that resolves its repository
 * from the environment silently targets the wrong one.
 *
 * The authoritative set comes from `git rev-parse --local-env-vars` rather than
 * a hand-maintained list. An earlier hand-written list agreed with its shell
 * counterpart yet silently omitted GIT_CONFIG, GIT_CONFIG_COUNT,
 * GIT_CONFIG_PARAMETERS, GIT_GRAFT_FILE, GIT_IMPLICIT_WORK_TREE,
 * GIT_NO_REPLACE_OBJECTS, GIT_REPLACE_REF_BASE and GIT_SHALLOW_FILE — agreement
 * between two incomplete lists proves nothing.
 *
 * Identity and transport variables are deliberately excluded: the product sets
 * its own commit identity, and inheriting GIT_SSH_COMMAND is safe.
 */
export const GIT_LOCATION_ENV_VARS = Object.freeze([...new Set([
  ...readGitLocalEnvVars(),
  ...GIT_EXTRA_SCRUBBED_ENV_VARS,
])].sort());

function readGitLocalEnvVars() {
  const result = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }

  return String(result.stdout).split('\n').map((line) => line.trim()).filter(Boolean);
}

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
