import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import { ensureGitRepo } from '../../src/git.js';
import { createHermeticThinkEnv, repoRoot } from '../fixtures/runtime.js';
import { createTempDir } from '../fixtures/tmp.js';

/**
 * Think commits as `think <think@local.invalid>` so a mind's history is
 * attributable to the agent rather than to whoever happened to run it. That
 * identity used to be installed by writing `user.name` and `user.email` into the
 * target repository's config.
 *
 * Persisting it there is the problem. `ensureGitRepo` accepts whatever directory
 * it is handed, so pointing Think at a directory that is already a Git
 * repository — a source checkout reached through `THINK_REPO_DIR`, say —
 * silently rewrote that repository's committer identity. The damage outlives the
 * process: every later commit made by hand in that checkout is authored as
 * `think@local.invalid`, which no forge can attribute to a real account, and
 * signature verification fails for every one of them.
 *
 * The identity is per-invocation state, not repository state, so these tests pin
 * both halves: Think still commits as the agent, and it never edits the host
 * repository's stored identity.
 */

const HOST_NAME = 'Host Developer';
const HOST_EMAIL = 'host@example.com';
const THINK_IDENTITY = 'think <think@local.invalid>';
const CLI = path.join(repoRoot, 'bin', 'think.js');

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function readLocalConfig(dir, key) {
  const result = spawnSync('git', ['-C', dir, 'config', '--local', '--get', key], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

/** A repository that already belongs to somebody, with its own identity set. */
async function createHostRepo() {
  const dir = await createTempDir('think-host-repo-');
  git(dir, ['init', '-q']);
  git(dir, ['config', '--local', 'user.name', HOST_NAME]);
  git(dir, ['config', '--local', 'user.email', HOST_EMAIL]);
  return dir;
}

test('ensureGitRepo leaves an existing repository\'s identity untouched', async () => {
  const hostRepo = await createHostRepo();

  await ensureGitRepo(hostRepo);

  assert.equal(
    readLocalConfig(hostRepo, 'user.name'),
    HOST_NAME,
    'Think overwrote the host repository\'s user.name.'
  );
  assert.equal(
    readLocalConfig(hostRepo, 'user.email'),
    HOST_EMAIL,
    'Think overwrote the host repository\'s user.email; commits made by hand in '
    + 'that checkout would be attributed to an address no forge can verify.'
  );
});

test('ensureGitRepo writes no identity into a repository it creates either', async () => {
  const parent = await createTempDir('think-fresh-mind-');
  const mindDir = path.join(parent, 'mind');

  await ensureGitRepo(mindDir);

  assert.equal(
    readLocalConfig(mindDir, 'user.email'),
    null,
    'Identity is per-invocation state and does not belong in stored config.'
  );
  assert.equal(
    readLocalConfig(mindDir, 'user.name'),
    null,
    'Persisting either half of the identity reintroduces the leak.'
  );
});

test('a real capture commits as the agent with no identity available anywhere', async () => {
  const homeDir = await createTempDir('think-agent-ident-');
  const mindDir = path.join(homeDir, 'mind');

  // Strip every source of ambient identity: no repository config (the mind is
  // created fresh and nothing writes user.* into it), no global or system
  // config, and no GIT_AUTHOR_*/GIT_COMMITTER_* in the environment. If the
  // runner's -c arguments were removed, git would refuse to commit and the
  // capture would fail outright — which is the regression this pins.
  const captured = spawnSync(process.execPath, [CLI, 'identity check'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: stripIdentityEnv(createHermeticThinkEnv({
      homeDir,
      upstreamUrl: '',
      extraEnv: { THINK_REPO_DIR: mindDir },
    })),
  });

  assert.equal(
    captured.status,
    0,
    `Capture failed with no ambient git identity: ${captured.stderr || captured.stdout}`
  );

  const authors = git(mindDir, ['log', '--all', '--format=%an <%ae>|%cn <%ce>']);
  const lines = authors.split('\n').filter(Boolean);

  assert.ok(lines.length > 0, 'Expected the capture to have written commits.');
  for (const line of lines) {
    assert.equal(
      line,
      `${THINK_IDENTITY}|${THINK_IDENTITY}`,
      `Every mind commit must be authored and committed as ${THINK_IDENTITY}.`
    );
  }

  assert.equal(
    readLocalConfig(mindDir, 'user.email'),
    null,
    'The capture must not have persisted an identity to get itself committed.'
  );
});

/** Remove every ambient identity source so only the runner's -c args remain. */
function stripIdentityEnv(env) {
  const copy = { ...env };
  for (const key of Object.keys(copy)) {
    if (/^(GIT_AUTHOR_|GIT_COMMITTER_)/u.test(key) || key === 'EMAIL') {
      delete copy[key];
    }
  }
  copy.GIT_CONFIG_GLOBAL = '/dev/null';
  copy.GIT_CONFIG_SYSTEM = '/dev/null';
  return copy;
}
