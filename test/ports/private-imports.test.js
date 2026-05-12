import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { repoRoot } from '../fixtures/runtime.js';

const CHECKPOINT_SOURCE_FILES = Object.freeze([
  'src/store/checkpoint-read.js',
  'src/store/checkpoint-state.js',
  'src/store/checkpoint-product-read.js',
]);

const RUNTIME_READ_SOURCE_FILES = Object.freeze([
  'src/store/runtime.js',
  'src/store/checkpoint-state.js',
]);

test('checkpoint read fast paths do not import git-warp internals from node_modules', async () => {
  const offenders = [];

  for (const relativePath of CHECKPOINT_SOURCE_FILES) {
    // eslint-disable-next-line no-await-in-loop -- this guard reports deterministic file-level evidence
    const source = await readFile(join(repoRoot, relativePath), 'utf8');
    if (source.includes('node_modules/@git-stunts/git-warp/src')) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'Expected production checkpoint code to use only public git-warp package exports.'
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
