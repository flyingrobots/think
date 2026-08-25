import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { ThinkError } from '../errors.js';
import { READ_MODEL_PREFIX } from './constants.js';
import {
  decodeNativeDocument,
  encodeNativeDocument,
} from './native-document.js';
import { openNativeMemory } from './native-runtime.js';

export const NATIVE_INDEX_PAGE_SIZE = 64;
export const NATIVE_INDEX_READ_LIMIT = 4096;

const LOCK_RETRY_MS = 20;
const LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 60_000;
const INDEX_PREFIX = `${READ_MODEL_PREFIX}v19:index:`;

export async function ensureEmptyNativeIndex(memory, kind, {
  knownMissing = false,
} = {}) {
  const id = indexId(kind);
  if (!knownMissing && await memory.exists(id)) {
    return false;
  }
  const state = emptyIndexState(kind);
  await memory.writeMemoryIndex({
    id,
    bytes: encodeNativeDocument('memory-index', state),
  });
  return true;
}

export async function appendIndexedMemoryObject(repoDir, {
  id,
  kind,
  facts,
}) {
  return await withWriteLock(
    repoDir,
    () => appendIndexedMemoryObjectLocked(repoDir, { id, kind, facts })
  );
}

export async function updateIndexedMemoryObject(repoDir, {
  id,
  kind,
  facts,
}) {
  return await withWriteLock(
    repoDir,
    () => updateIndexedMemoryObjectLocked(repoDir, { id, kind, facts })
  );
}

export async function listIndexedMemoryDocuments(repoDir, kind, {
  limit = 50,
  memory: providedMemory = null,
} = {}) {
  const requested = normalizeLimit(limit);
  if (requested === 0) {
    return Object.freeze([]);
  }
  const memory = providedMemory ?? await openNativeMemory(repoDir);
  if (!memory.hasHistory()) {
    return Object.freeze([]);
  }
  const reader = await memory.captureBoundedReader();
  const state = await readIndexState(reader, kind);
  if (!hasIndexEntries(state)) {
    return Object.freeze([]);
  }

  return await readRecentIndexPages(reader, state, requested);
}

export async function readIndexedMemoryDocument(repoDir, id, {
  kinds,
  memory: providedMemory = null,
} = {}) {
  const memory = providedMemory ?? await openNativeMemory(repoDir);
  if (!memory.hasHistory()) {
    return null;
  }
  const reader = await memory.captureBoundedReader();
  return await findDocumentAcrossKinds(reader, kinds, id);
}

export async function readIndexedMemoryBatch(repoDir, kind, {
  after = null,
  limit = 500,
} = {}) {
  const requested = normalizeLimit(limit);
  if (requested === 0) {
    return emptyBatch(after);
  }
  const memory = await openNativeMemory(repoDir);
  if (!memory.hasHistory()) {
    return emptyBatch(after);
  }
  const reader = await memory.captureBoundedReader();
  const state = await readIndexState(reader, kind);
  if (!hasIndexEntries(state)) {
    return emptyBatch(after);
  }

  const priorCursor = await locateIndexCursor(reader, state, after);
  return await readForwardIndexPages(reader, state, requested, priorCursor);
}

export async function listIndexedMemoryIds(repoDir, kind, options = {}) {
  const documents = await listIndexedMemoryDocuments(repoDir, kind, options);
  return Object.freeze(documents.map(document => document.id));
}

export async function readNativeIndexSummary(repoDir, kind) {
  const memory = await openNativeMemory(repoDir);
  if (!memory.hasHistory()) {
    return emptyIndexState(kind);
  }
  return await readIndexState(memory, kind);
}

async function appendIndexedMemoryObjectLocked(repoDir, { id, kind, facts }) {
  const memory = await openNativeMemory(repoDir);
  const hadHistory = memory.hasHistory();
  const position = await loadAppendPosition(memory, kind, hadHistory);
  const document = Object.freeze({
    id,
    kind,
    ...facts,
    previousKindId: position.previousId,
  });
  const nextPage = Object.freeze({
    ...position.page,
    entries: Object.freeze([...position.page.entries, document]),
  });
  const nextState = Object.freeze({
    ...position.state,
    total: position.state.total + 1,
    latestId: id,
    headPage: position.pageNumber,
  });
  await persistIndexAppend(memory, position, nextPage, nextState);
  if (!hadHistory) {
    await memory.repairBasis();
  }
  return Object.freeze({
    document,
    indexId: position.state.id,
    pageId: position.pageId,
    previousId: position.previousId,
    total: nextState.total,
  });
}

async function loadAppendPosition(memory, kind, hadHistory) {
  const state = hadHistory
    ? await readIndexState(memory, kind)
    : emptyIndexState(kind);
  const pageNumber = Math.floor(state.total / NATIVE_INDEX_PAGE_SIZE);
  const page = state.total % NATIVE_INDEX_PAGE_SIZE === 0
    ? emptyPage(kind, pageNumber)
    : await readIndexPage(memory, kind, pageNumber);
  return Object.freeze({
    page,
    pageId: indexPageId(kind, pageNumber),
    pageNumber,
    previousId: page.entries.at(-1)?.id
      ?? await previousPageLastId(memory, kind, pageNumber),
    state,
  });
}

async function persistIndexAppend(memory, position, page, state) {
  await memory.writeMemoryIndexPage({
    id: position.pageId,
    bytes: encodeNativeDocument('memory-index-page', page),
    declare: position.page.entries.length === 0,
  });
  await memory.writeMemoryIndex({
    id: position.state.id,
    bytes: encodeNativeDocument('memory-index', state),
    declare: !position.state.exists,
  });
}

async function updateIndexedMemoryObjectLocked(repoDir, { id, kind, facts }) {
  const memory = await openNativeMemory(repoDir);
  const located = await locateIndexedObjectForUpdate(memory, { id, kind });
  const document = Object.freeze({
    ...located.current,
    ...facts,
    id,
    kind,
  });
  const nextPage = Object.freeze({
    ...located.page,
    entries: Object.freeze(located.page.entries.map(entry => (
      entry.id === id ? document : entry
    ))),
  });
  const pageId = indexPageId(kind, located.page.pageNumber);
  await memory.writeMemoryIndexPage({
    id: pageId,
    bytes: encodeNativeDocument('memory-index-page', nextPage),
    declare: false,
  });
  return Object.freeze({
    document,
    indexId: located.state.id,
    pageId,
  });
}

async function locateIndexedObjectForUpdate(memory, { id, kind }) {
  requireIndexHistory(memory, id, kind);
  const state = await readIndexState(memory, kind);
  const page = await findIndexPage(memory, state, id);
  if (!page) {
    throw new ThinkError(
      `Native ${kind} index does not contain ${id}`,
      'V19_INDEXED_OBJECT_NOT_INDEXED'
    );
  }
  const current = page.entries.find(entry => entry.id === id);
  if (!current || current.kind !== kind) {
    throw missingIndexedObjectError(id, kind);
  }
  return Object.freeze({ current, page, state });
}

function requireIndexHistory(memory, id, kind) {
  if (!memory.hasHistory()) {
    throw missingIndexedObjectError(id, kind);
  }
}

function missingIndexedObjectError(id, kind) {
  return new ThinkError(
    `Cannot update missing native ${kind} object ${id}`,
    'V19_INDEXED_OBJECT_MISSING'
  );
}

async function readRecentIndexPages(reader, state, requested) {
  const documents = [];
  const pageNumbers = recentIndexPageNumbers(state, requested);
  const pages = await Promise.all(
    pageNumbers.map(pageNumber => readIndexPage(reader, state.kind, pageNumber))
  );
  for (const page of pages) {
    const remaining = requested - documents.length;
    documents.push(...page.entries.slice(-remaining).reverse());
  }
  return Object.freeze(documents);
}

function recentIndexPageNumbers(state, requested) {
  const oldestRequestedOffset = Math.max(0, state.total - requested);
  const oldestRequestedPage = Math.floor(
    oldestRequestedOffset / NATIVE_INDEX_PAGE_SIZE
  );
  return Object.freeze(
    Array.from(
      { length: state.headPage - oldestRequestedPage + 1 },
      (_, offset) => state.headPage - offset
    )
  );
}

async function findDocumentAcrossKinds(reader, kinds, id) {
  /* eslint-disable no-await-in-loop -- one coordinate checks a bounded kind and page set */
  for (const kind of kinds) {
    const state = await readIndexState(reader, kind);
    const page = state.exists && state.total > 0
      ? await findIndexPage(reader, state, id)
      : null;
    const document = page?.entries.find(entry => entry.id === id) ?? null;
    if (document !== null) {
      return document;
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

async function readForwardIndexPages(reader, state, requested, priorCursor) {
  const documents = [];
  let pageNumber = priorCursor?.pageNumber ?? 0;
  let offset = (priorCursor?.offset ?? -1) + 1;
  let cursor = priorCursor;
  /* eslint-disable no-await-in-loop -- one bounded batch reads persisted index pages */
  while (pageNumber <= state.headPage && documents.length < requested) {
    const page = await readIndexPage(reader, state.kind, pageNumber);
    const remaining = requested - documents.length;
    const selected = page.entries.slice(offset, offset + remaining);
    documents.push(...selected);
    cursor = selected.length > 0
      ? indexCursor(selected.at(-1), pageNumber, offset + selected.length - 1)
      : cursor;
    pageNumber += 1;
    offset = 0;
  }
  /* eslint-enable no-await-in-loop */
  return Object.freeze({
    documents: Object.freeze(documents),
    cursor,
  });
}

function indexId(kind) {
  return `${INDEX_PREFIX}${kind}`;
}

function indexPageId(kind, number) {
  return `${INDEX_PREFIX}${kind}:page:${String(number).padStart(8, '0')}`;
}

async function readIndexState(memory, kind) {
  const id = indexId(kind);
  const decoded = decodeNativeDocument(
    await memory.memoryIndex(id),
    'memory-index'
  );
  if (!decoded) {
    return emptyIndexState(kind);
  }
  return Object.freeze({
    id,
    kind,
    exists: true,
    headPage: integerOrZero(decoded.headPage),
    latestId: stringOrNull(decoded.latestId),
    total: integerOrZero(decoded.total),
  });
}

async function readIndexPage(memory, kind, pageNumber) {
  const decoded = decodeNativeDocument(
    await memory.memoryIndexPage(indexPageId(kind, pageNumber)),
    'memory-index-page'
  );
  if (!decoded || !Array.isArray(decoded.entries)) {
    return emptyPage(kind, pageNumber);
  }
  return Object.freeze({
    kind,
    pageNumber,
    entries: Object.freeze(decoded.entries.filter(isMemoryDocument)),
  });
}

async function previousPageLastId(memory, kind, pageNumber) {
  if (pageNumber === 0) {
    return null;
  }
  const previous = await readIndexPage(memory, kind, pageNumber - 1);
  return previous.entries.at(-1)?.id ?? null;
}

async function findIndexPage(memory, state, id) {
  /* eslint-disable no-await-in-loop -- indexed replacement scans bounded persisted pages */
  for (let pageNumber = state.headPage; pageNumber >= 0; pageNumber -= 1) {
    const page = await readIndexPage(memory, state.kind, pageNumber);
    if (page.entries.some(entry => entry.id === id)) {
      return page;
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

async function locateIndexCursor(memory, state, after) {
  const id = stringOrNull(after?.id);
  if (id === null) {
    return null;
  }
  if (isReusableIndexCursor(after, state)) {
    const cursorPage = await readIndexPage(memory, state.kind, after.pageNumber);
    const cursor = cursorForPage(cursorPage, id, after.offset);
    if (cursor) {
      return cursor;
    }
  }

  const page = await findIndexPage(memory, state, id);
  if (page) {
    return cursorForPage(page, id);
  }
  throw new ThinkError(
    `Native ${state.kind} index does not contain cursor ${id}`,
    'V19_INDEX_CURSOR_MISSING'
  );
}

function isReusableIndexCursor(cursor, state) {
  if (!Number.isInteger(cursor?.pageNumber)) {
    return false;
  }
  if (cursor.pageNumber < 0 || cursor.pageNumber > state.headPage) {
    return false;
  }
  return Number.isInteger(cursor.offset) && cursor.offset >= 0;
}

function cursorForPage(page, id, knownOffset = null) {
  const offset = knownOffset ?? page.entries.findIndex(entry => entry.id === id);
  if (page.entries[offset]?.id !== id) {
    return null;
  }
  return indexCursor(page.entries[offset], page.pageNumber, offset);
}

function indexCursor(document, pageNumber, offset) {
  return Object.freeze({
    id: document.id,
    pageNumber,
    offset,
  });
}

function emptyBatch(after) {
  const id = stringOrNull(after?.id);
  const cursor = id === null
    ? null
    : Object.freeze({
        id,
        pageNumber: integerOrZero(after?.pageNumber),
        offset: integerOrZero(after?.offset),
      });
  return Object.freeze({
    documents: Object.freeze([]),
    cursor,
  });
}

function emptyIndexState(kind) {
  return Object.freeze({
    id: indexId(kind),
    kind,
    exists: false,
    headPage: 0,
    latestId: null,
    total: 0,
  });
}

function emptyPage(kind, pageNumber) {
  return Object.freeze({
    kind,
    pageNumber,
    entries: Object.freeze([]),
  });
}

async function withWriteLock(repoDir, task) {
  await mkdir(repoDir, { recursive: true });
  const lockPath = path.join(repoDir, '.think-v19-write.lock');
  const startedAt = Date.now();
  let handle = null;

  /* eslint-disable no-await-in-loop -- atomic lock acquisition requires bounded polling */
  while (handle === null) {
    try {
      handle = await open(lockPath, 'wx');
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
      if (await isStaleLock(lockPath)) {
        await rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new ThinkError(
          `Timed out waiting for the native Think writer lock at ${lockPath}`,
          'V19_WRITE_LOCK_TIMEOUT'
        );
      }
      await delay(LOCK_RETRY_MS);
    }
  }
  /* eslint-enable no-await-in-loop */

  try {
    return await task();
  } finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}

async function isStaleLock(lockPath) {
  try {
    const details = await stat(lockPath);
    return Date.now() - details.mtimeMs >= STALE_LOCK_MS;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function normalizeLimit(limit) {
  if (!Number.isInteger(limit) || limit < 0) {
    return 50;
  }
  return Math.min(limit, NATIVE_INDEX_READ_LIMIT);
}

function hasIndexEntries(state) {
  return state.exists && state.total > 0;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function integerOrZero(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function isMemoryDocument(value) {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof value.id === 'string'
    && typeof value.kind === 'string';
}

function delay(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}
