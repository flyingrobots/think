import {
  CLASSIFICATION_PREFIX,
  CLASSIFICATIONS,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
} from './constants.js';
import { getCurrentTime } from './model.js';
import {
  decodeNativeDocument,
  encodeNativeDocument,
} from './native-document.js';
import { ensureEmptyNativeIndex } from './native-index.js';
import { openNativeMemory } from './native-runtime.js';

export async function migrateGraphModel(repoDir) {
  const memory = await openNativeMemory(repoDir);
  const hadHistory = memory.hasHistory();
  const previous = hadHistory
    ? decodeNativeDocument(
        await memory.memoryDocument(GRAPH_META_ID),
        'memory-object'
      )
    : null;
  const previousVersion = previous?.graphModelVersion ?? null;
  const timestamp = getCurrentTime().toISOString();

  if (previousVersion === GRAPH_MODEL_VERSION) {
    return Object.freeze({
      changed: false,
      graphModelVersion: GRAPH_MODEL_VERSION,
      edgesAdded: 0,
      edgesRemoved: 0,
      metadataUpdated: false,
    });
  }

  await memory.writeMemoryDocument({
    id: GRAPH_META_ID,
    bytes: encodeNativeDocument('memory-object', {
      ...previous,
      id: GRAPH_META_ID,
      kind: 'graph_meta',
      graphModelVersion: GRAPH_MODEL_VERSION,
      updatedAt: timestamp,
    }),
    declare: previous === null,
  });

  for (const name of CLASSIFICATIONS) {
    const id = `${CLASSIFICATION_PREFIX}${name}`;
    const exists = previous === null
      ? false
      // eslint-disable-next-line no-await-in-loop -- upgrades check the bounded object observer
      : await memory.exists(id);
    // eslint-disable-next-line no-await-in-loop -- standing ontology nodes are admitted one Intent at a time
    await memory.writeMemoryDocument({
      id,
      bytes: encodeNativeDocument('memory-object', {
        id,
        kind: 'classification',
        name,
        createdAt: timestamp,
      }),
      declare: !exists,
    });
  }
  await ensureEmptyNativeIndex(memory, 'capture', {
    knownMissing: !hadHistory,
  });

  return Object.freeze({
    changed: true,
    graphModelVersion: GRAPH_MODEL_VERSION,
    edgesAdded: 0,
    edgesRemoved: 0,
    metadataUpdated: true,
  });
}
