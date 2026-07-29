import { randomUUID } from 'node:crypto';

import { NotFoundError, ValidationError } from '../errors.js';
import { ANNOTATION_PREFIX } from './constants.js';
import { getCurrentTime } from './model.js';
import { appendIndexedMemoryObject } from './native-index.js';
import { openNativeMemory } from './native-runtime.js';
import {
  getStoredEntry,
  openProductReadHandle,
} from './runtime.js';

export async function saveAnnotation(repoDir, targetEntryId, text, {
  writerId = null,
} = {}) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new ValidationError('Annotation text cannot be empty');
  }
  const memory = await openNativeMemory(repoDir);
  const read = await openProductReadHandle(repoDir);
  if (!await getStoredEntry(read, targetEntryId)) {
    throw new NotFoundError(`Entry not found: ${targetEntryId}`);
  }

  const timestamp = getCurrentTime();
  const unique = randomUUID();
  const createdAt = timestamp.toISOString();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;
  const annotationId = `${ANNOTATION_PREFIX}${sortKey}`;

  await appendIndexedMemoryObject(repoDir, {
    id: annotationId,
    kind: 'annotation',
    facts: {
      kind: 'annotation',
      text: text.trim(),
      source: 'annotation',
      channel: 'cli',
      writerId: writerId ?? memory.writerId,
      createdAt,
      sortKey,
      targetEntryId,
    },
  });

  return Object.freeze({ annotationId, targetEntryId, createdAt });
}
