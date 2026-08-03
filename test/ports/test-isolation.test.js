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
    .filter((key) => key !== 'THINK_UPSTREAM_URL');

  assert.deepEqual(
    leaked,
    [],
    'Expected a prefix-wide scrub so newly added THINK_ knobs cannot silently reopen this hole.'
  );
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

test('baseEnv is applied and does not resurrect scrubbed Think state', () => {
  const env = buildEnv({ processEnv: { THINK_REPO_DIR: '/Users/dev/.think/claude' } });

  assert.equal(env.LANG, 'C');
  assert.equal(Object.hasOwn(env, 'THINK_REPO_DIR'), false);
});
