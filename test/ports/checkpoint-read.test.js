import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureGitRepo } from '../../src/git.js';
import {
  listRecent,
  saveRawCapture,
} from '../../src/store.js';
import { listCheckpointEntriesByKind } from '../../src/store/checkpoint-read.js';
import { openWarpApp } from '../../src/store/runtime.js';
import { runGit } from '../fixtures/git.js';
import { createTempDir } from '../fixtures/tmp.js';
import { formatResult } from '../fixtures/runtime.js';

test('checkpoint reads include CAS-backed raw tail captures', async () => {
  const repoDir = await createTempDir('think-checkpoint-read-');
  await ensureGitRepo(repoDir);
  const previousTestNow = process.env.THINK_TEST_NOW;

  try {
    for (let i = 0; i < 20; i += 1) {
      process.env.THINK_TEST_NOW = String(1_900_000_000_000 + i);
      // eslint-disable-next-line no-await-in-loop -- fixture needs ordered writer patches
      await saveRawCapture(repoDir, `checkpoint-backed raw capture ${i}`);
    }
    await (await openWarpApp(repoDir)).core().createCheckpoint();
    // eslint-disable-next-line require-atomic-updates -- test fixture restores THINK_TEST_NOW in finally
    process.env.THINK_TEST_NOW = String(1_900_000_000_020);
    await saveRawCapture(repoDir, 'checkpoint-backed raw capture 20');
  } finally {
    restoreTestNow(previousTestNow);
  }

  const checkpointRef = runGit(
    ['rev-parse', '--verify', '--quiet', 'refs/warp/think/checkpoints/head'],
    { cwd: repoDir },
  );
  assert.equal(
    checkpointRef.status,
    0,
    `Expected fixture writes to create an indexed checkpoint.\n${formatResult(checkpointRef)}`
  );

  const checkpointCaptures = await listCheckpointEntriesByKind(repoDir, 'capture');
  assert.ok(checkpointCaptures, 'Expected checkpoint-backed capture listing to be reachable.');
  assert.equal(checkpointCaptures.length, 21, 'Expected checkpoint read model to include raw tail captures.');

  const recent = await listRecent(repoDir, { count: 2 });

  assert.equal(recent.total, 21, 'Expected public recent reads to use the checkpoint-backed capture set.');
  assert.deepEqual(
    recent.entries.map((entry) => entry.text),
    [
      'checkpoint-backed raw capture 20',
      'checkpoint-backed raw capture 19',
    ],
    'Expected checkpoint reads to decode CAS-backed capture text from the live tail.',
  );
});

function restoreTestNow(previousTestNow) {
  if (previousTestNow === undefined) {
    delete process.env.THINK_TEST_NOW;
    return;
  }
  process.env.THINK_TEST_NOW = previousTestNow;
}
