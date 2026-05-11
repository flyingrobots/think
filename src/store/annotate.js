import { randomUUID } from 'node:crypto';

import { ValidationError, NotFoundError } from '../errors.js';
import { ANNOTATION_PREFIX, TEXT_MIME } from './constants.js';
import { encodeTextContent } from './content.js';
import { getCurrentTime } from './model.js';
import {
  createProductReadHandle,
  getStoredEntry,
  openWarpApp,
} from './runtime.js';

export async function saveAnnotation(repoDir, targetEntryId, text, { writerId = null } = {}) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new ValidationError('Annotation text cannot be empty');
  }

  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app, repoDir);
  const targetEntry = await getStoredEntry(read, targetEntryId);

  if (!targetEntry) {
    throw new NotFoundError(`Entry not found: ${targetEntryId}`);
  }

  const timestamp = getCurrentTime();
  const unique = randomUUID();
  const createdAt = timestamp.toISOString();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;
  const annotationId = `${ANNOTATION_PREFIX}${sortKey}`;
  const resolvedWriterId = writerId ?? app.writerId;

  await app.patch(async (patch) => {
    patch
      .addNode(annotationId)
      .setProperty(annotationId, 'kind', 'annotation')
      .setProperty(annotationId, 'source', 'annotation')
      .setProperty(annotationId, 'channel', 'cli')
      .setProperty(annotationId, 'writerId', resolvedWriterId)
      .setProperty(annotationId, 'createdAt', createdAt)
      .setProperty(annotationId, 'sortKey', sortKey)
      .setProperty(annotationId, 'targetEntryId', targetEntryId)
      .addEdge(annotationId, targetEntryId, 'annotates');

    await patch.attachContent(annotationId, encodeTextContent(text.trim()), { mime: TEXT_MIME });
  });

  return Object.freeze({
    annotationId,
    targetEntryId,
    createdAt,
  });
}
