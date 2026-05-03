import assert from 'node:assert/strict';
import test from 'node:test';
import Plumbing from '@git-stunts/plumbing';
import WarpApp, { GitGraphAdapter } from '@git-stunts/git-warp';

import { ensureGitRepo } from '../../src/git.js';
import { getCaptureAmbientContext, getAmbientProjectContext } from '../../src/project-context.js';
import {
  finalizeCapturedThought,
  GRAPH_NAME,
  openProductReadHandle,
  saveRawCapture,
} from '../../src/store.js';
import { createWriterId } from '../../src/store/model.js';
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
    ambientContext: getCaptureAmbientContext(projectRepoDir),
  });
  const readBeforeFollowthrough = await openProductReadHandle(localRepoDir);
  const savedBeforeFollowthrough = await readBeforeFollowthrough.view.getNodeProps(entry.id);

  assert.ok(savedBeforeFollowthrough, 'Expected saved raw entry to be readable immediately after local save.');
  assert.equal(savedBeforeFollowthrough.ambientCwd, projectRepoDir, 'Expected the cheap capture path to still record cwd immediately.');
  assert.equal(savedBeforeFollowthrough.ambientGitRoot ?? null, null, 'Expected git root enrichment to be deferred until followthrough.');
  assert.equal(savedBeforeFollowthrough.ambientGitRemote ?? null, null, 'Expected git remote enrichment to be deferred until followthrough.');
  assert.equal(savedBeforeFollowthrough.ambientGitBranch ?? null, null, 'Expected git branch enrichment to be deferred until followthrough.');

  const followthrough = await finalizeCapturedThought(localRepoDir, entry.id, {
    ambientContext: getAmbientProjectContext(projectRepoDir),
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

test('saveRawCapture retries after the cached writer ref is advanced externally', async () => {
  const localRepoDir = await createTempDir('think-capture-retry-');
  await ensureGitRepo(localRepoDir);

  await saveRawCapture(localRepoDir, 'seed capture before external writer advance');
  const externalApp = await openExternalWarpApp(localRepoDir);
  await externalApp.patch((patch) => {
    patch
      .addNode('external:writer-advance')
      .setProperty('external:writer-advance', 'kind', 'external_fixture');
  });

  const entry = await saveRawCapture(localRepoDir, 'capture should retry after writer ref conflict');
  const read = await openProductReadHandle(localRepoDir);
  const saved = await read.view.getNodeProps(entry.id);

  assert.ok(saved, 'Expected retrying raw capture to be committed after the writer ref advanced.');
  assert.equal(saved.kind, 'capture', 'Expected retried write to preserve capture semantics.');
});

async function openExternalWarpApp(repoDir) {
  return await WarpApp.open({
    persistence: new GitGraphAdapter({
      plumbing: Plumbing.createDefault({ cwd: repoDir }),
    }),
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
  });
}
