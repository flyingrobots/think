import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listIndexedMemoryDocuments,
  NATIVE_INDEX_PAGE_SIZE,
} from '../../src/store/native-index.js';
import { encodeNativeDocument } from '../../src/store/native-document.js';

test('recent native index pages read concurrently and preserve newest-first order', async () => {
  const fixture = createIndexFixture({ total: (NATIVE_INDEX_PAGE_SIZE * 2) + 1 });

  const documents = await listIndexedMemoryDocuments(
    '/tmp/think-native-index',
    'capture',
    {
      limit: NATIVE_INDEX_PAGE_SIZE + 2,
      memory: fixture.memory,
    }
  );

  assert.equal(fixture.startedBeforeRelease, 3);
  assert.deepEqual(fixture.pageReads, [
    'read_model:v19:index:capture:page:00000002',
    'read_model:v19:index:capture:page:00000001',
    'read_model:v19:index:capture:page:00000000',
  ]);
  assert.equal(documents.length, NATIVE_INDEX_PAGE_SIZE + 2);
  assert.equal(documents[0].id, 'entry:128');
  assert.equal(documents.at(-1).id, 'entry:63');
});

function createIndexFixture({ total }) {
  const pageReads = [];
  const fixture = {
    pageReads,
    startedBeforeRelease: 0,
  };
  const reader = createDelayedPageReader({ fixture, pageReads, total });
  fixture.memory = {
    hasHistory: () => true,
    captureBoundedReader: () => reader,
  };
  return fixture;
}

function createDelayedPageReader({ fixture, pageReads, total }) {
  const pages = indexPages();
  let release;
  const released = new Promise(resolve => {
    release = resolve;
  });
  const releaseTimer = setTimeout(() => {
    fixture.startedBeforeRelease = pageReads.length;
    release();
  }, 10);
  releaseTimer.unref();

  return {
    memoryIndex() {
      return encodeNativeDocument('memory-index', {
        headPage: 2,
        latestId: `entry:${total - 1}`,
        total,
      });
    },
    async memoryIndexPage(id) {
      pageReads.push(id);
      await released;
      const pageNumber = Number.parseInt(id.slice(-8), 10);
      return encodeNativeDocument('memory-index-page', pages.get(pageNumber));
    },
  };
}

function indexPages() {
  return new Map([
    [0, page(0, NATIVE_INDEX_PAGE_SIZE)],
    [1, page(NATIVE_INDEX_PAGE_SIZE, NATIVE_INDEX_PAGE_SIZE)],
    [2, page(NATIVE_INDEX_PAGE_SIZE * 2, 1)],
  ]);
}

function page(start, count) {
  return Object.freeze({
    entries: Object.freeze(
      Array.from({ length: count }, (_, offset) => Object.freeze({
        id: `entry:${start + offset}`,
        kind: 'capture',
        sortKey: String(start + offset).padStart(4, '0'),
        text: `capture ${start + offset}`,
      }))
    ),
  });
}
