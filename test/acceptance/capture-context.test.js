import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureGitRepo } from '../../src/git.js';
import {
  finalizeCapturedThought,
  openProductReadHandle,
  saveRawCapture,
} from '../../src/store.js';
import { createGitRepo, runGit } from '../fixtures/git.js';
import { createTempDir } from '../fixtures/tmp.js';
import { formatResult } from '../fixtures/runtime.js';

test('saveRawCapture writes cwd receipts first and defers git enrichment to followthrough', async () => {
  const localRepoDir = await createTempDir('think-capture-context-');
  await ensureGitRepo(localRepoDir);

  const projectRepoDir = await createGitRepo({ prefix: 'ambient-project-', name: 'ambient-project' });
  const remoteUrl = 'git@github.com:flyingrobots/ambient-project.git';
  const addRemote = runGit(['remote', 'add', 'origin', remoteUrl], { cwd: projectRepoDir });
  const branch = runGit(['branch', '--show-current'], { cwd: projectRepoDir });
  const gitRoot = runGit(['rev-parse', '--show-toplevel'], { cwd: projectRepoDir });

  assert.equal(
    addRemote.status,
    0,
    `Expected deterministic project repo fixture to accept an origin remote.\n${formatResult(addRemote)}`
  );
  assert.equal(
    branch.status,
    0,
    `Expected deterministic project repo fixture to expose its current branch.\n${formatResult(branch)}`
  );
  assert.equal(
    gitRoot.status,
    0,
    `Expected deterministic project repo fixture to expose its git root.\n${formatResult(gitRoot)}`
  );

  const entry = await saveRawCapture(localRepoDir, 'capture should stay cheap', {
    cwd: projectRepoDir,
  });
  const readBeforeFollowthrough = await openProductReadHandle(localRepoDir);
  const savedBeforeFollowthrough = await readBeforeFollowthrough.view.getNodeProps(entry.id);

  assert.ok(savedBeforeFollowthrough, 'Expected saved raw entry to be readable immediately after local save.');
  assert.equal(savedBeforeFollowthrough.ambientCwd, projectRepoDir, 'Expected the cheap capture path to still record cwd immediately.');
  assert.equal(savedBeforeFollowthrough.ambientGitRoot ?? null, null, 'Expected git root enrichment to be deferred until followthrough.');
  assert.equal(savedBeforeFollowthrough.ambientGitRemote ?? null, null, 'Expected git remote enrichment to be deferred until followthrough.');
  assert.equal(savedBeforeFollowthrough.ambientGitBranch ?? null, null, 'Expected git branch enrichment to be deferred until followthrough.');

  const followthrough = await finalizeCapturedThought(localRepoDir, entry.id, {
    cwd: projectRepoDir,
  });
  const readAfterFollowthrough = await openProductReadHandle(localRepoDir);
  const savedAfterFollowthrough = await readAfterFollowthrough.view.getNodeProps(entry.id);

  assert.ok(followthrough.entry, 'Expected followthrough to keep the saved capture entry available.');
  assert.ok(savedAfterFollowthrough, 'Expected saved raw entry to remain readable after followthrough.');
  assert.equal(savedAfterFollowthrough.ambientCwd, projectRepoDir, 'Expected followthrough to preserve the original cwd receipt.');
  assert.equal(
    savedAfterFollowthrough.ambientGitRoot,
    String(gitRoot.stdout || '').trim(),
    'Expected followthrough to backfill the git root receipt.'
  );
  assert.equal(savedAfterFollowthrough.ambientGitRemote, remoteUrl, 'Expected followthrough to backfill the git remote receipt.');
  assert.equal(
    savedAfterFollowthrough.ambientGitBranch,
    String(branch.stdout || '').trim(),
    'Expected followthrough to backfill the current git branch receipt.'
  );
});
