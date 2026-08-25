import assert from 'node:assert/strict';
import test from 'node:test';
import { Runtime } from '@git-stunts/git-warp';

import { ensureGitRepo } from '../../src/git.js';
import { getAmbientProjectContext } from '../../src/project-context.js';
import {
  finalizeCapturedThought,
  getGraphModelStatus,
  GRAPH_NAME,
  inspectRawEntry,
  listRecent,
  openProductReadHandle,
  saveAnnotation,
  saveRawCapture,
  saveReflectResponse,
  startReflect,
} from '../../src/store.js';
import { createWriterId } from '../../src/store/model.js';
import { thinkMemory } from '../../src/generated/think-memory.generated.js';
import {
  getStoredEntry,
  listEntriesByKind,
} from '../../src/store/runtime.js';
import { createGitRepo, runGit } from '../fixtures/git.js';
import { createTempDir } from '../fixtures/tmp.js';
import { formatResult } from '../fixtures/runtime.js';

test('saveRawCapture stores complete ambient receipts in the native capture document', async () => {
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
    ambientContext: getAmbientProjectContext(projectRepoDir),
  });
  const readBeforeFollowthrough = await openProductReadHandle(localRepoDir);
  const savedBeforeFollowthrough = await getStoredEntry(readBeforeFollowthrough, entry.id);

  assert.ok(savedBeforeFollowthrough, 'Expected saved raw entry to be readable immediately after local save.');
  assert.equal(savedBeforeFollowthrough.ambientCwd, projectRepoDir);
  assert.equal(savedBeforeFollowthrough.ambientGitRoot, String(gitRoot.stdout || '').trim());
  assert.equal(savedBeforeFollowthrough.ambientGitRemote, remoteUrl);
  assert.equal(savedBeforeFollowthrough.ambientGitBranch, String(branch.stdout || '').trim());

  const followthrough = await finalizeCapturedThought(localRepoDir, entry.id, {
    ambientContext: getAmbientProjectContext(projectRepoDir),
  });
  const readAfterFollowthrough = await openProductReadHandle(localRepoDir);
  const savedAfterFollowthrough = await getStoredEntry(readAfterFollowthrough, entry.id);

  assert.ok(followthrough.entry, 'Expected followthrough to keep the saved capture entry available.');
  assert.ok(savedAfterFollowthrough, 'Expected saved raw entry to remain readable after followthrough.');
  assert.equal(savedAfterFollowthrough.ambientCwd, projectRepoDir);
  assert.equal(savedAfterFollowthrough.ambientGitRoot, String(gitRoot.stdout || '').trim());
  assert.equal(savedAfterFollowthrough.ambientGitRemote, remoteUrl);
  assert.equal(savedAfterFollowthrough.ambientGitBranch, String(branch.stdout || '').trim());
});

test('new-mind raw capture initializes History metadata before followthrough', async () => {
  const localRepoDir = await createTempDir('think-capture-bootstrap-');
  await ensureGitRepo(localRepoDir);

  await saveRawCapture(localRepoDir, 'bootstrap History metadata atomically', {
    initializeGraphModel: true,
  });

  const status = await getGraphModelStatus(localRepoDir);
  assert.equal(status.migrationRequired, false);
  assert.equal(status.currentGraphModelVersion, status.requiredGraphModelVersion);
});

test('raw captures preserve the bounded recent index before followthrough', async () => {
  const localRepoDir = await createTempDir('think-capture-index-');
  await ensureGitRepo(localRepoDir);

  await saveRawCapture(localRepoDir, 'first pending followthrough');
  await saveRawCapture(localRepoDir, 'second pending followthrough');

  const recent = await listRecent(localRepoDir, { count: 2 });
  assert.deepEqual(
    recent.entries.map((entry) => entry.text),
    ['second pending followthrough', 'first pending followthrough']
  );
  assert.equal(recent.total, 2);
});

test('saveRawCapture retries after the cached writer ref is advanced externally', async () => {
  const localRepoDir = await createTempDir('think-capture-retry-');
  await ensureGitRepo(localRepoDir);

  await saveRawCapture(localRepoDir, 'seed capture before external writer advance');
  await advanceWriterExternally(localRepoDir, 'external:writer-advance');

  const entry = await saveRawCapture(localRepoDir, 'capture should retry after writer ref conflict');
  const read = await openProductReadHandle(localRepoDir);
  const saved = await getStoredEntry(read, entry.id);

  assert.ok(saved, 'Expected retrying raw capture to be committed after the writer ref advanced.');
  assert.equal(saved.kind, 'capture', 'Expected retried write to preserve capture semantics.');
});

test('saveAnnotation retries after the cached writer ref is advanced externally', async () => {
  const localRepoDir = await createTempDir('think-annotation-retry-');
  await ensureGitRepo(localRepoDir);

  const entry = await saveRawCapture(localRepoDir, 'annotation retry seed capture');
  await advanceWriterExternally(localRepoDir, 'external:annotation-writer-advance');

  const result = await saveAnnotation(localRepoDir, entry.id, 'annotation should retry after writer ref conflict');
  const inspected = await inspectRawEntry(localRepoDir, entry.id);

  assert.ok(result.annotationId, 'Expected annotation save to return the created annotation id.');
  assert.ok(
    inspected.annotations.some((annotation) => annotation.annotationId === result.annotationId),
    'Expected the retried annotation write to be visible on inspect.'
  );
});

test('reflect writes retry after the cached writer ref is advanced externally', async () => {
  const localRepoDir = await createTempDir('think-reflect-retry-');
  await ensureGitRepo(localRepoDir);

  const entry = await saveRawCapture(
    localRepoDir,
    'We should redesign browse startup because transitional reads can hide latency.'
  );
  await advanceWriterExternally(localRepoDir, 'external:reflect-start-writer-advance');

  const started = await startReflect(localRepoDir, entry.id, { promptType: 'challenge' });
  assert.equal(started.ok, true, 'Expected reflect start to retry and create a session after writer ref conflict.');

  await advanceWriterExternally(localRepoDir, 'external:reflect-reply-writer-advance');

  const saved = await saveReflectResponse(
    localRepoDir,
    started.sessionId,
    'The transition should keep the alternate screen stable while loading the next view.'
  );

  assert.ok(saved, 'Expected reflect reply to retry and save after writer ref conflict.');
  assert.equal(saved.sessionId, started.sessionId, 'Expected retried reflect reply to preserve session lineage.');

  const read = await openProductReadHandle(localRepoDir);
  const sessions = await listEntriesByKind(read, 'reflect_session');
  assert.equal(sessions.length, 1, 'Expected the native reflect-session index to retain one session.');
  assert.equal(
    sessions[0].stepCount,
    1,
    'Expected the indexed reflect session to advance with the exact session document.'
  );
});

async function advanceWriterExternally(repoDir, nodeId) {
  const runtime = await Runtime.open({
    at: repoDir,
    writer: createWriterId(),
  });
  try {
    const lane = await runtime.lane(GRAPH_NAME);
    await lane.write(thinkMemory.intents.declareMemoryObject({ subject: nodeId }));
  } finally {
    await runtime.close();
  }
}
