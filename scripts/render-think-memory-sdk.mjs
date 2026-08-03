import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  mutationDeclareMemoryObjectOperation,
  mutationStoreMemoryDocumentOperation,
  mutationStoreMemoryIndexOperation,
  mutationStoreMemoryIndexPageOperation,
  queryMemoryDocumentOperation,
  queryMemoryIndexOperation,
  queryMemoryIndexPageOperation,
  queryMemoryObjectExistsOperation,
} from '../src/generated/think-memory.wesley.generated.ts';

class ThinkMemorySdkGenerationError extends Error {}

const contracts = Object.freeze([
  [
    mutationDeclareMemoryObjectOperation,
    'MUTATION:declareMemoryObject:NODE_ADD:subject',
    [
      'operationType',
      'fieldName',
      'directives.intent.kind',
      'directives.intent.subject',
    ],
  ],
  [
    mutationStoreMemoryDocumentOperation,
    'MUTATION:storeMemoryDocument:PROPERTY_SET_BYTES:subject:think.memory-document.v1:value',
    intentPropertyFields(),
  ],
  [
    mutationStoreMemoryIndexOperation,
    'MUTATION:storeMemoryIndex:PROPERTY_SET_BYTES:subject:think.memory-index.v1:value',
    intentPropertyFields(),
  ],
  [
    mutationStoreMemoryIndexPageOperation,
    'MUTATION:storeMemoryIndexPage:PROPERTY_SET_BYTES:subject:think.memory-index-page.v1:value',
    intentPropertyFields(),
  ],
  [
    queryMemoryDocumentOperation,
    'QUERY:memoryDocument:think.memory.document:PROPERTY:subject:think.memory-document.v1:EXACTLY_ONE:BYTES',
    observerPropertyFields(),
  ],
  [
    queryMemoryIndexOperation,
    'QUERY:memoryIndex:think.memory.index:PROPERTY:subject:think.memory-index.v1:EXACTLY_ONE:BYTES',
    observerPropertyFields(),
  ],
  [
    queryMemoryIndexPageOperation,
    'QUERY:memoryIndexPage:think.memory.index-page:PROPERTY:subject:think.memory-index-page.v1:EXACTLY_ONE:BYTES',
    observerPropertyFields(),
  ],
  [
    queryMemoryObjectExistsOperation,
    'QUERY:memoryObjectExists:think.memory.object-exists:NODE_EXISTS:subject:EXACTLY_ONE:BOOLEAN',
    [
      'operationType',
      'fieldName',
      'directives.observer.id',
      'directives.observer.reading',
      'directives.observer.subject',
      'directives.observer.cardinality',
      'directives.observer.decoder',
    ],
  ],
]);

for (const [operation, expected, fields] of contracts) {
  const actual = fields.map(field => readPath(operation, field)).join(':');
  if (actual !== expected) {
    throw new ThinkMemorySdkGenerationError(
      `Think memory contract drifted at ${operation.fieldName}: expected ${expected}; received ${actual}`
    );
  }
}

const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(import.meta.dirname, '..', 'src', 'generated', 'think-memory.generated.js');

const source = `/* @generated from contracts/think-memory.graphql by Wesley and Think's v19 renderer. */

import {
  createObserver,
  intent,
  reading,
} from '@git-stunts/git-warp/advanced';

const MEMORY_DOCUMENT_KEY = 'think.memory-document.v1';
const MEMORY_INDEX_KEY = 'think.memory-index.v1';
const MEMORY_INDEX_PAGE_KEY = 'think.memory-index-page.v1';

class ThinkMemorySdkValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'ThinkMemorySdkValidationError';
  }
}

function requireRequest(request, operation) {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    throw new ThinkMemorySdkValidationError(\`\${operation} request must be an object\`);
  }
  return request;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ThinkMemorySdkValidationError(\`\${field} must be a non-empty string\`);
  }
  return value;
}

function requireBytes(value, field = 'Think bytes Observer') {
  if (value === null || value instanceof Uint8Array) {
    return value;
  }
  if (
    typeof value === 'object'
    && value !== null
    && typeof value.toUint8Array === 'function'
  ) {
    return value.toUint8Array();
  }
  throw new ThinkMemorySdkValidationError(\`\${field} expected a byte value or null\`);
}

function requireObservedBoolean(value) {
  if (typeof value !== 'boolean') {
    throw new ThinkMemorySdkValidationError('Think existence Observer expected a boolean');
  }
  return value;
}

function storeBytes(fields, operation, key) {
  const request = requireRequest(fields, operation);
  const value = requireBytes(request.value, \`\${operation}.value\`);
  if (value === null) {
    throw new ThinkMemorySdkValidationError(\`\${operation}.value must be Uint8Array\`);
  }
  return intent.property.set({
    subject: requireString(request.subject, \`\${operation}.subject\`),
    key,
    value,
  });
}

function declareMemoryObject(fields) {
  const request = requireRequest(fields, 'thinkMemory.declareMemoryObject');
  return intent.node.add({
    subject: requireString(request.subject, 'thinkMemory.declareMemoryObject.subject'),
  });
}

function storeMemoryDocument(fields) {
  return storeBytes(fields, 'thinkMemory.storeMemoryDocument', MEMORY_DOCUMENT_KEY);
}

function storeMemoryIndex(fields) {
  return storeBytes(fields, 'thinkMemory.storeMemoryIndex', MEMORY_INDEX_KEY);
}

function storeMemoryIndexPage(fields) {
  return storeBytes(fields, 'thinkMemory.storeMemoryIndexPage', MEMORY_INDEX_PAGE_KEY);
}

function observeBytes(fields, operation, id, key) {
  const request = requireRequest(fields, operation);
  return createObserver(
    id,
    reading.property({
      subject: requireString(request.subject, \`\${operation}.subject\`),
      key,
    }),
    requireBytes,
  );
}

function memoryDocument(fields) {
  return observeBytes(
    fields,
    'thinkMemory.memoryDocument',
    'think.memory.document',
    MEMORY_DOCUMENT_KEY,
  );
}

function memoryIndex(fields) {
  return observeBytes(
    fields,
    'thinkMemory.memoryIndex',
    'think.memory.index',
    MEMORY_INDEX_KEY,
  );
}

function memoryIndexPage(fields) {
  return observeBytes(
    fields,
    'thinkMemory.memoryIndexPage',
    'think.memory.index-page',
    MEMORY_INDEX_PAGE_KEY,
  );
}

function memoryObjectExists(fields) {
  const request = requireRequest(fields, 'thinkMemory.memoryObjectExists');
  return createObserver(
    'think.memory.object-exists',
    reading.node.exists({
      subject: requireString(request.subject, 'thinkMemory.memoryObjectExists.subject'),
    }),
    requireObservedBoolean,
  );
}

export const thinkMemory = Object.freeze({
  intents: Object.freeze({
    declareMemoryObject,
    storeMemoryDocument,
    storeMemoryIndex,
    storeMemoryIndexPage,
  }),
  observers: Object.freeze({
    memoryDocument,
    memoryIndex,
    memoryIndexPage,
    memoryObjectExists,
  }),
});
`;

await writeFile(output, source);

function intentPropertyFields() {
  return [
    'operationType',
    'fieldName',
    'directives.intent.kind',
    'directives.intent.subject',
    'directives.intent.property',
    'directives.intent.value',
  ];
}

function observerPropertyFields() {
  return [
    'operationType',
    'fieldName',
    'directives.observer.id',
    'directives.observer.reading',
    'directives.observer.subject',
    'directives.observer.property',
    'directives.observer.cardinality',
    'directives.observer.decoder',
  ];
}

function readPath(value, field) {
  return field.split('.').reduce((current, part) => current?.[part], value);
}
