import assert from 'node:assert/strict';
import test from 'node:test';

import { thinkMemory } from '../../src/generated/think-memory.generated.js';
import {
  decodeNativeDocument,
  encodeNativeDocument,
  INDEX_DOCUMENT_KEY,
  INDEX_PAGE_DOCUMENT_KEY,
} from '../../src/store/native-document.js';
import { NativeMemoryCoordinateReader } from '../../src/store/native-runtime.js';

test('generated Think SDK emits native v19 Intent values', () => {
  const declaration = thinkMemory.intents.declareMemoryObject({
    subject: 'entry:test',
  });
  const document = thinkMemory.intents.storeMemoryDocument({
    subject: 'entry:test',
    value: new Uint8Array([1, 2, 3]),
  });
  assert.deepEqual(declaration.descriptor, {
    kind: 'node.add',
    subject: 'entry:test',
  });
  assert.equal(document.descriptor.kind, 'property.set');
  assert.equal(document.descriptor.key, 'think.memory-document.v1');
});

test('native Think documents round-trip a typed aggregate', () => {
  const expected = Object.freeze({
    id: 'entry:test',
    kind: 'capture',
    text: 'bounded v19 document',
    createdAt: '2026-07-28T00:00:00.000Z',
  });
  const encoded = encodeNativeDocument('memory-object', expected);
  const decoded = decodeNativeDocument(encoded, 'memory-object');

  assert.deepEqual(decoded, expected);
  assert.equal(decodeNativeDocument(encoded, 'memory-index'), null);
});

test('native coordinate reader reuses one bounded optic for index pages', async () => {
  const indexBytes = encodeNativeDocument('memory-index', {
    total: 65,
    headPage: 1,
  });
  const pageBytes = encodeNativeDocument('memory-index-page', {
    entries: [{ id: 'entry:test', kind: 'capture' }],
  });
  const { optic, reads } = coordinateReaderFixture(indexBytes, pageBytes);
  const reader = new NativeMemoryCoordinateReader(optic);

  assert.deepEqual(await reader.memoryIndex('index:test'), indexBytes);
  assert.deepEqual(await reader.memoryIndexPage('page:test'), pageBytes);
  assert.equal(await reader.memoryIndexPage('page:missing'), null);
  assert.deepEqual(reads, [
    { subject: 'index:test', key: INDEX_DOCUMENT_KEY },
    { subject: 'page:test', key: INDEX_PAGE_DOCUMENT_KEY },
    { subject: 'page:missing', key: INDEX_PAGE_DOCUMENT_KEY },
  ]);
});

function coordinateReaderFixture(indexBytes, pageBytes) {
  const reads = [];
  const values = new Map([
    [`index:test\0${INDEX_DOCUMENT_KEY}`, indexBytes],
    [`page:test\0${INDEX_PAGE_DOCUMENT_KEY}`, {
      toUint8Array: () => pageBytes,
    }],
  ]);
  const optic = {
    node(subject) {
      return {
        prop(key) {
          return {
            read() {
              reads.push({ subject, key });
              const value = values.get(`${subject}\0${key}`);
              return Promise.resolve({
                exists: value !== undefined,
                value,
              });
            },
          };
        },
      };
    },
  };
  return { optic, reads };
}
