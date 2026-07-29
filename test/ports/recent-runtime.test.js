import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStoredEntry,
  listRecentStoredEntries,
  readNodeText,
} from '../../src/store/runtime.js';

test('listRecentStoredEntries requests only the bounded native capture window', async () => {
  const read = createNativeRead([
    capture('entry:newest'),
    capture('entry:middle'),
    capture('entry:oldest'),
  ]);

  const entries = await listRecentStoredEntries(read, { limit: 1 });

  assert.deepEqual(entries.map(entry => entry.id), ['entry:newest']);
  assert.deepEqual(read.indexReads, [{ kind: 'capture', limit: 1 }]);
  assert.deepEqual(read.documentReads, []);
});

test('listRecentStoredEntries hydrates the capped page documents without exact reads', async () => {
  const read = createNativeRead([
    capture('entry:newest'),
    capture('entry:middle'),
    capture('entry:oldest'),
  ]);

  const entries = await listRecentStoredEntries(read, { limit: 2 });

  assert.deepEqual(entries.map(entry => entry.id), ['entry:newest', 'entry:middle']);
  assert.deepEqual(read.indexReads, [{ kind: 'capture', limit: 2 }]);
  assert.deepEqual(read.documentReads, []);
});

test('getStoredEntry decodes one exact native memory document', async () => {
  const expected = capture('entry:exact', { text: 'native document text' });
  const read = createNativeRead([expected]);

  const entry = await getStoredEntry(read, expected.id);

  assert.equal(entry.text, 'native document text');
  assert.deepEqual(read.documentReads, [expected.id]);
});

test('getStoredEntry returns null when the native document is absent', async () => {
  const read = createNativeRead([]);

  assert.equal(await getStoredEntry(read, 'entry:missing'), null);
  assert.deepEqual(read.documentReads, ['entry:missing']);
});

test('readNodeText reads inline text from the native document only', async () => {
  const expected = capture('entry:text', { text: 'inline text' });
  const read = createNativeRead([expected]);

  assert.equal(await readNodeText(read, expected.id), 'inline text');
  assert.deepEqual(read.documentReads, [expected.id]);
});

function capture(id, overrides = {}) {
  return Object.freeze({
    id,
    kind: 'capture',
    writerId: 'writer:test',
    createdAt: new Date(1770000000000).toISOString(),
    sortKey: id,
    text: `text for ${id}`,
    ...overrides,
  });
}

function createNativeRead(documents) {
  const documentsById = new Map(documents.map(document => [document.id, document]));
  const read = {
    documentReads: [],
    indexReads: [],
    repoDir: '/tmp/think-native-read',
  };
  read.listDocumentsByKind = (kind, { limit }) => {
    read.indexReads.push({ kind, limit });
    return documents.filter(document => document.kind === kind).slice(0, limit);
  };
  read.readDocument = (nodeId) => {
    read.documentReads.push(nodeId);
    return documentsById.get(nodeId) ?? null;
  };
  read.memory = {
    memoryDocument: () => null,
  };
  return read;
}
