import assert from 'node:assert/strict';
import test from 'node:test';

import { getBrowseWindowForRead } from '../../src/store.js';

test('browse window hydrates only the selected capture and adjacent chronology entries', async () => {
  const read = createCaptureRead([
    capture('entry:1774434000000-far-newer', 'far newer', '2026-03-25T10:20:00.000Z'),
    capture('entry:1774432920000-newer', 'newer neighbor', '2026-03-25T10:02:00.000Z'),
    capture('entry:1774432860000-current', 'current capture', '2026-03-25T10:01:00.000Z'),
    capture('entry:1774432800000-older', 'older neighbor', '2026-03-25T10:00:00.000Z'),
    capture('entry:1774432200000-far-older', 'far older', '2026-03-25T09:50:00.000Z'),
  ]);

  const window = await getBrowseWindowForRead(read, 'entry:1774432860000-current');

  assert.equal(window.current.text, 'current capture');
  assert.equal(window.newer.text, 'newer neighbor');
  assert.equal(window.older.text, 'older neighbor');
  assert.deepEqual(
    [...read.documentReads].sort(),
    [
      'entry:1774432800000-older',
      'entry:1774432860000-current',
      'entry:1774432920000-newer',
    ],
    'Expected browse to avoid exact reads for unrelated capture documents.'
  );
});

function capture(id, text, createdAt) {
  return Object.freeze({
    id,
    kind: 'capture',
    text,
    writerId: 'test',
    createdAt,
    sortKey: id.slice('entry:'.length),
  });
}

function createCaptureRead(entries) {
  const documentsById = new Map(entries.map(entry => [entry.id, entry]));
  const documentReads = new Set();
  return {
    documentReads,
    repoDir: '/tmp/think-fake-read',
    listDocumentsByKind(kind, { limit }) {
      assert.equal(kind, 'capture');
      return entries.slice(0, limit);
    },
    readDocument(nodeId) {
      documentReads.add(nodeId);
      return documentsById.get(nodeId) ?? null;
    },
  };
}
