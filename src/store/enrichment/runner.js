import { CLASSIFICATION_PREFIX, TOPIC_PREFIX, KEYWORD_PREFIX, GRAPH_META_ID } from '../constants.js';
import { createArtifactId, getCurrentTime } from '../model.js';
import {
  createProductReadHandle,
  getStoredEntry,
  listEntriesByKind,
  openWarpApp,
} from '../runtime.js';
import { extractTopics } from './auto-tags.js';
import { classifyThought } from './semantic-parse.js';

const TOPIC_PROMOTION_THRESHOLD = 2;

/**
 * Run the enrichment pipeline on all un-enriched captures in a repo.
 * Uses worldline query API — no full graph materialization.
 */
export async function runEnrichmentPipeline(repoDir) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app, repoDir);
  const { view } = read;

  // 1. Determine the starting point (high-water mark cursor)
  const metaProps = await view.getNodeProps(GRAPH_META_ID);
  const cursorId = metaProps?.lastEnrichedCaptureId;

  let captures = [];
  if (cursorId && await view.hasNode(cursorId)) {
    // Incremental path: Traverse 'newer' edges from the cursor
    const forwardIds = await view.traverse.bfs(cursorId, {
      dir: 'out',
      labelFilter: 'newer',
    });

    for (const id of forwardIds) {
      if (id === cursorId) { continue; }
      // eslint-disable-next-line no-await-in-loop -- sequential retrieval of new captures
      const entry = await getStoredEntry(read, id);
      if (entry && entry.kind === 'capture') {
        captures.push(entry);
      }
    }
  } else {
    // Bootstrap path: O(N) scan (only happens once or if cursor is lost)
    captures = await listEntriesByKind(read, 'capture');
  }

  if (captures.length === 0) {
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

  // Find existing auto_tags receipts via query
  const existingReceipts = new Set();
  const tagReceiptResult = await view.query().match('artifact:*').where({ kind: 'auto_tags' }).run();
  for (const node of tagReceiptResult.nodes ?? []) {
    if (node.props.primaryInputId) {
      existingReceipts.add(node.props.primaryInputId);
    }
  }

  // Find existing semantic_parse receipts via query
  const existingParseReceipts = new Set();
  const parseReceiptResult = await view.query().match('artifact:*').where({ kind: 'semantic_parse' }).run();
  for (const node of parseReceiptResult.nodes ?? []) {
    if (node.props.primaryInputId) {
      existingParseReceipts.add(node.props.primaryInputId);
    }
  }

  // Find existing topic nodes via query
  const existingTopicNodes = new Set();
  const topicResult = await view.query().match(`${TOPIC_PREFIX}*`).run();
  for (const node of topicResult.nodes ?? []) {
    existingTopicNodes.add(node.id);
  }

  // Find existing keyword nodes via query
  const existingKeywordNodes = new Set();
  const keywordResult = await view.query().match(`${KEYWORD_PREFIX}*`).run();
  for (const node of keywordResult.nodes ?? []) {
    existingKeywordNodes.add(node.id);
  }

  // Track candidate topic counts and classifications across all captures
  const topicCounts = new Map();
  const thoughtTopics = new Map();
  const thoughtClassifications = new Map();

  for (const capture of captures) {
    const { thoughtId } = capture;
    if (!thoughtId) { continue; }

    if (!thoughtTopics.has(thoughtId)) {
      const topics = extractTopics(capture.text);
      thoughtTopics.set(thoughtId, topics);
      for (const topic of topics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }
    }

    if (!thoughtClassifications.has(thoughtId)) {
      thoughtClassifications.set(thoughtId, classifyThought(capture.text));
    }
  }

  // Determine promoted topics
  const promotedTopics = new Set();
  for (const [topic, count] of topicCounts) {
    if (count >= TOPIC_PROMOTION_THRESHOLD) {
      promotedTopics.add(topic);
    }
  }

  // Check existing about edges per thought via traversal
  const existingAboutEdges = new Set();
  for (const [thoughtId] of thoughtTopics) {
    // eslint-disable-next-line no-await-in-loop -- per-thought traversal
    const traversal = await view.query().match(thoughtId).outgoing('about').run();
    for (const node of traversal.nodes ?? []) {
      existingAboutEdges.add(`${thoughtId}\0${node.id}`);
    }
  }

  // Check existing mentions edges per thought via traversal (inverted index)
  const existingMentionsEdges = new Set();
  for (const [thoughtId] of thoughtTopics) {
    // eslint-disable-next-line no-await-in-loop -- per-thought traversal
    const traversal = await view.query().match(thoughtId).outgoing('mentions').run();
    for (const node of traversal.nodes ?? []) {
      existingMentionsEdges.add(`${thoughtId}\0${node.id}`);
    }
  }

  // Check existing classified_as edges per thought via traversal
  const existingClassifiedEdges = new Set();
  for (const [thoughtId] of thoughtClassifications) {
    // eslint-disable-next-line no-await-in-loop -- per-thought traversal
    const traversal = await view.query().match(thoughtId).outgoing('classified_as').run();
    for (const node of traversal.nodes ?? []) {
      existingClassifiedEdges.add(`${thoughtId}\0${node.id}`);
    }
  }

  const timestamp = getCurrentTime().toISOString();
  let topicNodesCreated = 0;
  let keywordNodesCreated = 0;
  let aboutEdgesAdded = 0;
  let mentionsEdgesAdded = 0;
  let classifiedEdgesAdded = 0;
  let receiptsCreated = 0;

  await app.patch((patch) => {
    // Create keyword nodes and mentions edges (The Inverted Index)
    for (const [thoughtId, topics] of thoughtTopics) {
      for (const keyword of topics) {
        const keywordNodeId = `${KEYWORD_PREFIX}${keyword}`;
        if (!existingKeywordNodes.has(keywordNodeId)) {
          patch
            .addNode(keywordNodeId)
            .setProperty(keywordNodeId, 'kind', 'keyword')
            .setProperty(keywordNodeId, 'name', keyword)
            .setProperty(keywordNodeId, 'createdAt', timestamp);
          existingKeywordNodes.add(keywordNodeId); // Local cache to prevent double-add in same patch
          keywordNodesCreated++;
        }

        const edgeKey = `${thoughtId}\0${keywordNodeId}`;
        if (!existingMentionsEdges.has(edgeKey)) {
          patch.addEdge(thoughtId, keywordNodeId, 'mentions');
          mentionsEdgesAdded++;
        }
      }
    }

    // Create promoted topic nodes
    for (const topic of promotedTopics) {
      const nodeId = `${TOPIC_PREFIX}${topic}`;
      if (!existingTopicNodes.has(nodeId)) {
        patch
          .addNode(nodeId)
          .setProperty(nodeId, 'kind', 'topic')
          .setProperty(nodeId, 'name', topic)
          .setProperty(nodeId, 'normalizedName', topic)
          .setProperty(nodeId, 'createdAt', timestamp)
          .setProperty(nodeId, 'source', 'auto_tags');
        topicNodesCreated++;
      }
    }

    // Add about edges for promoted topics
    for (const [thoughtId, topics] of thoughtTopics) {
      for (const topic of topics) {
        if (!promotedTopics.has(topic)) { continue; }
        const topicNodeId = `${TOPIC_PREFIX}${topic}`;
        const edgeKey = `${thoughtId}\0${topicNodeId}`;
        if (!existingAboutEdges.has(edgeKey)) {
          patch.addEdge(thoughtId, topicNodeId, 'about');
          aboutEdgesAdded++;
        }
      }
    }

    // Create auto_tags receipt artifacts
    for (const capture of captures) {
      const { thoughtId } = capture;
      if (!thoughtId || existingReceipts.has(thoughtId)) { continue; }

      const topics = thoughtTopics.get(thoughtId) || [];
      const artifactId = createArtifactId('auto_tags', thoughtId);

      patch
        .addNode(artifactId)
        .setProperty(artifactId, 'kind', 'auto_tags')
        .setProperty(artifactId, 'primaryInputKind', 'thought')
        .setProperty(artifactId, 'primaryInputId', thoughtId)
        .setProperty(artifactId, 'topicsExtracted', JSON.stringify(topics))
        .setProperty(artifactId, 'method', 'keyword-extraction')
        .setProperty(artifactId, 'topicNodesCreated', 0)
        .setProperty(artifactId, 'deriver', 'think')
        .setProperty(artifactId, 'deriverVersion', '1')
        .setProperty(artifactId, 'schemaVersion', '1')
        .setProperty(artifactId, 'createdAt', timestamp)
        .addEdge(artifactId, thoughtId, 'derived_from');

      receiptsCreated++;
    }

    // Add classified_as edges
    for (const [thoughtId, result] of thoughtClassifications) {
      for (const classification of result.classifications) {
        const classNodeId = `${CLASSIFICATION_PREFIX}${classification}`;
        const edgeKey = `${thoughtId}\0${classNodeId}`;
        if (!existingClassifiedEdges.has(edgeKey)) {
          patch.addEdge(thoughtId, classNodeId, 'classified_as');
          classifiedEdgesAdded++;
        }
      }
    }

    // Create semantic_parse receipt artifacts
    for (const capture of captures) {
      const { thoughtId } = capture;
      if (!thoughtId || existingParseReceipts.has(thoughtId)) { continue; }

      const result = thoughtClassifications.get(thoughtId);
      if (!result) { continue; }

      const artifactId = createArtifactId('semantic_parse', thoughtId);

      patch
        .addNode(artifactId)
        .setProperty(artifactId, 'kind', 'semantic_parse')
        .setProperty(artifactId, 'primaryInputKind', 'thought')
        .setProperty(artifactId, 'primaryInputId', thoughtId)
        .setProperty(artifactId, 'classifications', JSON.stringify(result.classifications))
        .setProperty(artifactId, 'markers', JSON.stringify(result.markers))
        .setProperty(artifactId, 'deriver', 'think')
        .setProperty(artifactId, 'deriverVersion', '1')
        .setProperty(artifactId, 'schemaVersion', '1')
        .setProperty(artifactId, 'createdAt', timestamp)
        .addEdge(artifactId, thoughtId, 'derived_from');
    }

    // Update the high-water mark cursor to the latest capture processed
    const latestProcessed = captures.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (latestProcessed) {
      patch.setProperty(GRAPH_META_ID, 'lastEnrichedCaptureId', latestProcessed.id);
    }
  });

  return Object.freeze({
    capturesProcessed: captures.length,
    topicNodesCreated,
    keywordNodesCreated,
    aboutEdgesAdded,
    mentionsEdgesAdded,
    classifiedEdgesAdded,
    receiptsCreated,
    promotedTopics: [...promotedTopics].sort(),
  });
}

/**
 * List all promoted topics in the graph with thought counts.
 * Uses worldline query API — no full graph materialization.
 */
export async function listTopics(repoDir) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app, repoDir);

  const topicResult = await read.view.query().match(`${TOPIC_PREFIX}*`).where({ kind: 'topic' }).run();
  const topics = [];

  for (const node of topicResult.nodes ?? []) {
    // eslint-disable-next-line no-await-in-loop -- per-topic traversal for count
    const incoming = await read.view.query().match(node.id).incoming('about').run();
    const thoughtCount = (incoming.nodes ?? []).length;

    topics.push(Object.freeze({
      name: node.props.name,
      thoughtCount,
      createdAt: node.props.createdAt,
    }));
  }

  return topics.sort((a, b) => b.thoughtCount - a.thoughtCount);
}
