import assert from 'node:assert/strict';
import test from 'node:test';

import { DependencyError } from '../../src/errors.js';
import { createAppContentReader } from '../../src/store/content-reader.js';

test('content reader uses app getContent when available', async () => {
  const reader = createAppContentReader({
    getContent: (nodeId) => Promise.resolve(new TextEncoder().encode(`app:${nodeId}`)),
  });

  assert.equal(new TextDecoder().decode(await reader('node:1')), 'app:node:1');
});

test('content reader uses core getContent when app getContent is unavailable', async () => {
  const reader = createAppContentReader({
    core: () => ({
      getContent: (nodeId) => Promise.resolve(new TextEncoder().encode(`core:${nodeId}`)),
    }),
  });

  assert.equal(new TextDecoder().decode(await reader('node:2')), 'core:node:2');
});

test('content reader reports missing git-warp content API as dependency error', () => {
  assert.throws(
    () => createAppContentReader({}),
    (error) => error instanceof DependencyError && /content reader/.test(error.message)
  );
});
