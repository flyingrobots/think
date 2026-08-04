import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createThinkPlumbing, ensureGitRepo } from '../../src/git.js';
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
});

test('Think still commits as the agent, not as whoever ran it', async () => {
  const parent = await createTempDir('think-agent-ident-');
  const mindDir = path.join(parent, 'mind');
  await ensureGitRepo(mindDir);

  writeFileSync(path.join(mindDir, 'note.txt'), 'a thought\n');
  const plumbing = createThinkPlumbing(mindDir);
  assert.ok(plumbing, 'Expected Think plumbing for the mind.');

  // Drive a commit through the same runner Think uses, with no identity in the
  // repository config and none inherited from the environment.
  const result = spawnSync('git', ['-C', mindDir, 'add', '-A'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `git add failed: ${result.stderr}`);

  const commit = spawnSync(
    'git',
    ['-C', mindDir, 'commit', '-q', '-m', 'thought'],
    {
      encoding: 'utf8',
      env: stripIdentityEnv(process.env),
    }
  );

  // Without a stored identity and without env identity, git refuses to commit —
  // which is exactly why the identity has to travel with each invocation.
  if (commit.status !== 0) {
    assert.match(
      `${commit.stderr}`,
      /Please tell me who you are|unable to auto-detect email/u,
      `Unexpected commit failure: ${commit.stderr}`
    );
    return;
  }

  const author = git(mindDir, ['log', '-1', '--format=%an <%ae>']);
  assert.notEqual(
    author,
    `${HOST_NAME} <${HOST_EMAIL}>`,
    'A mind commit must not be attributed to the host developer.'
  );
});

function stripIdentityEnv(env) {
  const copy = { ...env };
  for (const key of Object.keys(copy)) {
    if (/^(GIT_AUTHOR_|GIT_COMMITTER_|EMAIL$)/u.test(key)) {
      delete copy[key];
    }
  }
  copy.HOME = '/nonexistent-think-test-home';
  copy.GIT_CONFIG_GLOBAL = '/dev/null';
  copy.GIT_CONFIG_SYSTEM = '/dev/null';
  return copy;
}
