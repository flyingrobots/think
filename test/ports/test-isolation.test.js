import assert from 'node:assert/strict';
import test from 'node:test';

import { createHermeticThinkEnv, THINK_ENV_PREFIX } from '../fixtures/runtime.js';

/**
 * These guard the test harness itself.
 *
 * Think resolves its mind directory from THINK_REPO_DIR *before* falling back
 * to $HOME/.think/repo (see getLocalRepoDir in src/paths.js). A fixture that
 * pins HOME but inherits THINK_REPO_DIR therefore runs the suite against
 * whatever mind the developer has exported — writing test captures into real
 * memory. Multi-agent setups export exactly that variable to namespace their
 * minds, so this is the normal case, not an exotic one.
 */

/**
 * Think variables the fixture sets on purpose, so they are not leaks: the upstream
 * URL is pinned per context, and the followthrough budget is pinned generously so
 * acceptance assertions do not race a 6s wall clock.
 */
const FIXTURE_OWNED_THINK_VARS = new Set([
  'THINK_UPSTREAM_URL',
  'THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS',
]);

const HOME_DIR = '/tmp/think-home-test';
const UPSTREAM_URL = '/tmp/think-upstream.git';

function buildEnv({ processEnv = {}, extraEnv = {} } = {}) {
  return createHermeticThinkEnv({
    processEnv,
    baseEnv: { LANG: 'C' },
    extraEnv,
    homeDir: HOME_DIR,
    upstreamUrl: UPSTREAM_URL,
  });
}

test('inherited THINK_REPO_DIR cannot redirect the suite at a real mind', () => {
  const env = buildEnv({ processEnv: { THINK_REPO_DIR: '/Users/dev/.think/claude' } });

  assert.equal(
    Object.hasOwn(env, 'THINK_REPO_DIR'),
    false,
    'Expected an inherited THINK_REPO_DIR to be scrubbed so HOME alone decides the mind.'
  );
});

test('every inherited THINK_ variable is scrubbed, not just the known dangerous ones', () => {
  const env = buildEnv({
    processEnv: {
      THINK_REPO_DIR: '/Users/dev/.think/claude',
      THINK_PROMPT_METRICS_FILE: '/Users/dev/.think/metrics/prompt-ux.jsonl',
      THINK_CAPTURE_INGRESS: 'share',
      THINK_CAPTURE_SOURCE_APP: 'Safari',
      THINK_CAPTURE_SOURCE_URL: 'https://example.com',
      THINK_SOME_FUTURE_KNOB: 'surprise',
    },
  });

  const leaked = Object.keys(env)
    .filter((key) => key.startsWith(THINK_ENV_PREFIX))
    .filter((key) => !FIXTURE_OWNED_THINK_VARS.has(key));

  assert.deepEqual(
    leaked,
    [],
    'Expected a prefix-wide scrub so newly added THINK_ knobs cannot silently reopen this hole.'
  );
});

test('inherited git location variables cannot redirect a spawned Think process', () => {
  // Git exports GIT_DIR and friends to every hook, so a suite run from the
  // repo's own pre-push hook inherits them. Any git call that resolves its
  // repository from the environment then operates on the wrong repository.
  const env = createHermeticThinkEnv({
    processEnv: {
      GIT_DIR: '/Users/dev/git/think/.git',
      GIT_WORK_TREE: '/Users/dev/git/think',
      GIT_INDEX_FILE: '/Users/dev/git/think/.git/index',
      GIT_OBJECT_DIRECTORY: '/Users/dev/git/think/.git/objects',
      GIT_COMMON_DIR: '/Users/dev/git/think/.git',
      GIT_QUARANTINE_PATH: '/Users/dev/git/think/.git/quarantine',
    },
    homeDir: HOME_DIR,
    upstreamUrl: UPSTREAM_URL,
  });

  const leaked = Object.keys(env).filter((key) => key.startsWith('GIT_'));

  assert.deepEqual(leaked, [], 'Expected git repository-location variables to be scrubbed.');
});

test('git identity and transport variables are left alone', () => {
  const env = createHermeticThinkEnv({
    processEnv: { GIT_SSH_COMMAND: 'ssh -v', GIT_TERMINAL_PROMPT: '0' },
    homeDir: HOME_DIR,
    upstreamUrl: UPSTREAM_URL,
  });

  assert.equal(env.GIT_SSH_COMMAND, 'ssh -v', 'Expected transport configuration to survive.');
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
});

test('mixed-case Think variables are scrubbed, because Windows env lookup is case-insensitive', () => {
  // On Windows an inherited `Think_Repo_Dir` passes a case-sensitive filter, yet
  // the spawned child still resolves it through process.env.THINK_REPO_DIR — so
  // the suite could be redirected into a developer's real mind again.
  const env = buildEnv({
    processEnv: {
      Think_Repo_Dir: '/Users/dev/.think/claude',
      think_prompt_metrics_file: '/Users/dev/.think/metrics/prompt-ux.jsonl',
      ThInK_CaPtUrE_iNgReSs: 'share',
    },
  });

  const leaked = Object.keys(env).filter((key) => (
    key.toUpperCase().startsWith('THINK_') && !FIXTURE_OWNED_THINK_VARS.has(key.toUpperCase())
  ));

  assert.deepEqual(leaked, [], 'Expected mixed-case Think variables to be scrubbed too.');
});

test('mixed-case git location variables are scrubbed as well', () => {
  const env = buildEnv({ processEnv: { Git_Dir: '/Users/dev/git/think/.git', git_work_tree: '/Users/dev/git/think' } });

  const leaked = Object.keys(env).filter((key) => key.toUpperCase().startsWith('GIT_'));

  assert.deepEqual(leaked, [], 'Expected mixed-case git location variables to be scrubbed.');
});

test('non-Think environment such as PATH still reaches the child process', () => {
  const env = buildEnv({
    processEnv: { PATH: '/usr/bin:/bin', HOME: '/Users/dev', SHELL: '/bin/zsh' },
  });

  assert.equal(env.PATH, '/usr/bin:/bin', 'Expected PATH to survive so the child can spawn git and node.');
  assert.equal(env.SHELL, '/bin/zsh');
});

test('the fixture pins HOME and the upstream URL over anything inherited', () => {
  const env = buildEnv({ processEnv: { HOME: '/Users/dev', THINK_UPSTREAM_URL: 'git@github.com:dev/real.git' } });

  assert.equal(env.HOME, HOME_DIR);
  assert.equal(env.THINK_UPSTREAM_URL, UPSTREAM_URL);
});

test('tests can still set THINK_ variables deliberately through extraEnv', () => {
  const env = buildEnv({
    processEnv: { THINK_PROMPT_METRICS_FILE: '/Users/dev/.think/metrics/prompt-ux.jsonl' },
    extraEnv: {
      THINK_PROMPT_METRICS_FILE: '/tmp/fixture-metrics.jsonl',
      THINK_TEST_NOW: '1700000000000',
    },
  });

  assert.equal(
    env.THINK_PROMPT_METRICS_FILE,
    '/tmp/fixture-metrics.jsonl',
    'Expected an explicit fixture override to win over the scrub.'
  );
  assert.equal(env.THINK_TEST_NOW, '1700000000000');
});

test('a missing homeDir is rejected instead of silently leaking the real home', () => {
  // Node drops env pairs whose value is undefined, so a forgotten homeDir would
  // leave HOME unset in the child. getHomeDir() then falls back to
  // os.homedir(), pointing the suite back at the developer's real ~/.think —
  // reopening the hole this fixture exists to close, with no visible error.
  assert.throws(
    () => createHermeticThinkEnv({ processEnv: {}, upstreamUrl: UPSTREAM_URL }),
    /homeDir is required/,
    'Expected a missing homeDir to fail loudly.'
  );
  assert.throws(
    () => createHermeticThinkEnv({ processEnv: {}, homeDir: '', upstreamUrl: UPSTREAM_URL }),
    /homeDir is required/,
    'Expected an empty homeDir to fail loudly.'
  );
});

test('a missing upstreamUrl is normalised to empty rather than dropped', () => {
  const env = createHermeticThinkEnv({ processEnv: {}, homeDir: HOME_DIR });

  assert.equal(
    env.THINK_UPSTREAM_URL,
    '',
    'Expected an explicit empty upstream so an inherited value cannot survive.'
  );
});

test('baseEnv is applied and does not resurrect scrubbed Think state', () => {
  const env = buildEnv({ processEnv: { THINK_REPO_DIR: '/Users/dev/.think/claude' } });

  assert.equal(env.LANG, 'C');
  assert.equal(Object.hasOwn(env, 'THINK_REPO_DIR'), false);
});
