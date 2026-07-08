import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { repoRoot } from '../fixtures/runtime.js';

const RUNTIME_READ_SOURCE_FILES = Object.freeze([
  'src/store/runtime.js',
  'src/store/queries.js',
  'src/browse/adapters/git-warp.js',
]);

test('runtime read paths do not import Think-managed git-warp cache modules', async () => {
  const offenders = [];

  for (const relativePath of RUNTIME_READ_SOURCE_FILES) {
    // eslint-disable-next-line no-await-in-loop -- this guard reports deterministic file-level evidence
    const source = await readFile(join(repoRoot, relativePath), 'utf8');
    if (source.includes('checkpoint-state.js') || source.includes('checkpoint-read.js')) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'Expected product read paths not to manage git-warp cache/checkpoint modules.'
  );
});

test('runtime read paths do not call GitGraphAdapter.createRuntimeBlobStorage without feature detection', async () => {
  const offenders = [];

  for (const relativePath of RUNTIME_READ_SOURCE_FILES) {
    // eslint-disable-next-line no-await-in-loop -- this guard reports deterministic file-level evidence
    const source = await readFile(join(repoRoot, relativePath), 'utf8');
    if (source.includes('.createRuntimeBlobStorage()')) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'Expected runtime reads to feature-detect the optional git-warp blob-storage helper before using it.'
  );
});
