import {
  CLASSIFICATION_PREFIX,
  GRAPH_META_ID,
  KEYWORD_PREFIX,
  TOPIC_PREFIX,
} from '../constants.js';
import { createArtifactId, getCurrentTime } from '../model.js';
import {
  decodeNativeDocument,
  encodeNativeDocument,
} from '../native-document.js';
import {
  appendIndexedMemoryObject,
  readIndexedMemoryBatch,
} from '../native-index.js';
import { openNativeMemory } from '../native-runtime.js';
import {
  listEntriesByKind,
  openProductReadHandle,
} from '../runtime.js';
import { invalidateSearchIndex } from '../queries.js';
import { extractTopics } from './auto-tags.js';
import { classifyThought } from './semantic-parse.js';

const TOPIC_PROMOTION_THRESHOLD = 2;
const ENRICHMENT_BATCH_SIZE = 500;

export async function runEnrichmentPipeline(repoDir) {
  const memory = await openNativeMemory(repoDir);
  const graphMetadata = decodeNativeDocument(
    await memory.memoryDocument(GRAPH_META_ID),
    'memory-object'
  );
  const batch = await readIndexedMemoryBatch(repoDir, 'capture', {
    after: graphMetadata?.lastEnrichedCaptureId
      ? {
          id: graphMetadata.lastEnrichedCaptureId,
          pageNumber: graphMetadata.lastEnrichedCapturePage,
          offset: graphMetadata.lastEnrichedCaptureOffset,
        }
      : null,
    limit: ENRICHMENT_BATCH_SIZE,
  });
  const captures = batch.documents;
  if (captures.length === 0) {
    return emptyResult();
  }
  const read = await openProductReadHandle(repoDir);
  const keywordIds = await indexedIds(read, 'keyword');
  const topicIds = await indexedIds(read, 'topic');
  const autoTagIds = await indexedIds(read, 'auto_tags');
  const semanticParseIds = await indexedIds(read, 'semantic_parse');

  const timestamp = getCurrentTime().toISOString();
  const topicCounts = new Map();
  const captureTopics = new Map();
  const captureClassifications = new Map();

  for (const capture of captures) {
    const topics = extractTopics(capture.text);
    captureTopics.set(capture.id, topics);
    captureClassifications.set(capture.id, classifyThought(capture.text));
    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const promotedTopics = [...topicCounts]
    .filter(([, count]) => count >= TOPIC_PROMOTION_THRESHOLD)
    .map(([topic]) => topic)
    .sort();
  let keywordNodesCreated = 0;
  let topicNodesCreated = 0;
  let mentionsEdgesAdded = 0;
  let aboutEdgesAdded = 0;
  let classifiedEdgesAdded = 0;
  let receiptsCreated = 0;

  for (const capture of captures) {
    const topics = captureTopics.get(capture.id) ?? [];
    for (const keyword of topics) {
      const keywordId = `${KEYWORD_PREFIX}${keyword}`;
      if (!keywordIds.has(keywordId)) {
        // eslint-disable-next-line no-await-in-loop -- enrichment admits bounded domain Intents deliberately
        await appendIndexedMemoryObject(repoDir, {
          id: keywordId,
          kind: 'keyword',
          facts: { kind: 'keyword', name: keyword, createdAt: timestamp },
        });
        keywordIds.add(keywordId);
        keywordNodesCreated += 1;
      }
      mentionsEdgesAdded += 1;
    }

    for (const topic of topics.filter(candidate => promotedTopics.includes(candidate))) {
      const topicId = `${TOPIC_PREFIX}${topic}`;
      if (!topicIds.has(topicId)) {
        // eslint-disable-next-line no-await-in-loop -- enrichment admits bounded domain Intents deliberately
        await appendIndexedMemoryObject(repoDir, {
          id: topicId,
          kind: 'topic',
          facts: {
            kind: 'topic',
            name: topic,
            normalizedName: topic,
            createdAt: timestamp,
            source: 'auto_tags',
            thoughtCount: topicCounts.get(topic) ?? 0,
          },
        });
        topicIds.add(topicId);
        topicNodesCreated += 1;
      }
      aboutEdgesAdded += 1;
    }

    const classification = captureClassifications.get(capture.id);
    for (const name of classification?.classifications ?? []) {
      const classificationId = `${CLASSIFICATION_PREFIX}${name}`;
      // eslint-disable-next-line no-await-in-loop -- enrichment declares bounded ontology endpoints
      if (!await memory.exists(classificationId)) {
        // eslint-disable-next-line no-await-in-loop -- enrichment admits bounded domain Intents deliberately
        await memory.writeMemoryDocument({
          id: classificationId,
          bytes: encodeNativeDocument('memory-object', {
            id: classificationId,
            kind: 'classification',
            name,
            createdAt: timestamp,
          }),
        });
      }
      classifiedEdgesAdded += 1;
    }

    const tagArtifactId = createArtifactId('auto_tags', capture.id);
    if (!autoTagIds.has(tagArtifactId)) {
      // eslint-disable-next-line no-await-in-loop -- receipt objects use the bounded native document index
      await appendIndexedMemoryObject(repoDir, {
        id: tagArtifactId,
        kind: 'auto_tags',
        facts: {
          kind: 'auto_tags',
          primaryInputKind: 'capture',
          primaryInputId: capture.id,
          topicsExtractedCount: topics.length,
          method: 'keyword-extraction',
          deriver: 'think',
          deriverVersion: '1',
          schemaVersion: '1',
          createdAt: timestamp,
        },
      });
      autoTagIds.add(tagArtifactId);
      receiptsCreated += 1;
    }

    const parseArtifactId = createArtifactId('semantic_parse', capture.id);
    if (!semanticParseIds.has(parseArtifactId)) {
      // eslint-disable-next-line no-await-in-loop -- receipt objects use the bounded native document index
      await appendIndexedMemoryObject(repoDir, {
        id: parseArtifactId,
        kind: 'semantic_parse',
        facts: {
          kind: 'semantic_parse',
          primaryInputKind: 'capture',
          primaryInputId: capture.id,
          classificationCount: classification?.classifications?.length ?? 0,
          markerCount: classification?.markers?.length ?? 0,
          deriver: 'think',
          deriverVersion: '1',
          schemaVersion: '1',
          createdAt: timestamp,
        },
      });
      semanticParseIds.add(parseArtifactId);
      receiptsCreated += 1;
    }
  }

  const latest = captures.at(-1);
  if (latest && batch.cursor) {
    await memory.writeMemoryDocument({
      id: GRAPH_META_ID,
      bytes: encodeNativeDocument('memory-object', {
        ...graphMetadata,
        id: GRAPH_META_ID,
        kind: 'graph_meta',
        lastEnrichedCaptureId: latest.id,
        lastEnrichedCapturePage: batch.cursor.pageNumber,
        lastEnrichedCaptureOffset: batch.cursor.offset,
        updatedAt: timestamp,
      }),
      declare: graphMetadata === null,
    });
  }
  invalidateSearchIndex(repoDir);

  return Object.freeze({
    capturesProcessed: captures.length,
    topicNodesCreated,
    keywordNodesCreated,
    aboutEdgesAdded,
    mentionsEdgesAdded,
    classifiedEdgesAdded,
    receiptsCreated,
    promotedTopics,
  });
}

export async function listTopics(repoDir) {
  const read = await openProductReadHandle(repoDir);
  const topics = await listEntriesByKind(read, 'topic');
  return topics
    .map(topic => Object.freeze({
      name: topic.name ?? topic.text,
      thoughtCount: Number(topic.thoughtCount ?? 0),
      createdAt: topic.createdAt,
    }))
    .sort((left, right) => right.thoughtCount - left.thoughtCount);
}

async function indexedIds(read, kind) {
  return new Set(
    (await listEntriesByKind(read, kind, { limit: 4096 }))
      .map(entry => entry.id)
  );
}

function emptyResult() {
  return Object.freeze({
    capturesProcessed: 0,
    topicNodesCreated: 0,
    keywordNodesCreated: 0,
    aboutEdgesAdded: 0,
    mentionsEdgesAdded: 0,
    classifiedEdgesAdded: 0,
    receiptsCreated: 0,
    promotedTopics: [],
  });
}
