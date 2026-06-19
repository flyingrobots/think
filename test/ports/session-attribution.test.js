import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureGitRepo } from '../../src/git.js';
import {
  finalizeCapturedThought,
  getBrowseWindow,
  saveRawCapture,
} from '../../src/store.js';
import { createTempDir } from '../fixtures/tmp.js';

test('finalization attributes idle-gap captures to the previous active session', async () => {
  const repoDir = await createTempDir('think-session-attribution-');
  await ensureGitRepo(repoDir);
  const base = Date.UTC(2026, 2, 25, 10, 0, 0);

  const first = await saveCaptureAt(repoDir, 'first capture in the session', base);
  const second = await saveCaptureAt(repoDir, 'second capture inside the idle gap', base + 60_000);

  const firstWindow = await getBrowseWindow(repoDir, first.id);
  const secondWindow = await getBrowseWindow(repoDir, second.id);

  assert.equal(
    secondWindow.sessionContext.sessionId,
    firstWindow.sessionContext.sessionId,
    'Expected the second capture to reuse the previous active session id.'
  );
  assert.equal(secondWindow.sessionContext.reasonKind, 'temporal_proximity');
  assert.equal(secondWindow.sessionContext.sessionPosition, 2);
  assert.equal(secondWindow.sessionContext.sessionCount, 2);
});

async function saveCaptureAt(repoDir, thought, nowMs) {
  const previousTestNow = process.env.THINK_TEST_NOW;
  try {
    process.env.THINK_TEST_NOW = String(nowMs);
    const entry = await saveRawCapture(repoDir, thought);
    await finalizeCapturedThought(repoDir, entry.id);
    return entry;
  } finally {
    restoreTestNow(previousTestNow);
  }
}

function restoreTestNow(previousTestNow) {
  if (previousTestNow === undefined) {
    delete process.env.THINK_TEST_NOW;
    return;
  }
  process.env.THINK_TEST_NOW = previousTestNow;
}
