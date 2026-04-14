import { CLASSIFICATION_PREFIX, TOPIC_PREFIX } from '../constants.js';
import { createArtifactId, getCurrentTime } from '../model.js';
import {
  createProductReadHandle,
  listEntriesByKind,
  openWarpApp,
} from '../runtime.js';
import { extractTopics } from './auto-tags.js';
import { classifyThought } from './semantic-parse.js';

const TOPIC_PROMOTION_THRESHOLD = 2;

/**
 * Run the enrichment pipeline on all un-enriched captures in a repo.
 */
export async function runEnrichmentPipeline(repoDir) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const captures = await listEntriesByKind(read, 'capture');
  const edges = await read.view.getEdges();

  // Find thoughts that already have auto_tags receipts
  const existingReceipts = new Set();
  const allNodes = await read.view.getNodes();
  for (const node of allNodes) {
    if (node.startsWith('artifact:')) {
      // eslint-disable-next-line no-await-in-loop -- sequential graph reads during enrichment scan
      const props = await read.view.getNodeProps(node);
      if (props?.kind === 'auto_tags') {
        existingReceipts.add(props.primaryInputId);
      }
    }
  }

  // Track candidate topic counts across all captures
  const topicCounts = new Map();
  const thoughtTopics = new Map();

  for (const capture of captures) {
    const { thoughtId } = capture;
    if (!thoughtId) { continue; }

    const topics = extractTopics(capture.text);
    thoughtTopics.set(thoughtId, topics);

    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  // Determine which topics are promoted
  const promotedTopics = new Set();
  for (const [topic, count] of topicCounts) {
    if (count >= TOPIC_PROMOTION_THRESHOLD) {
      promotedTopics.add(topic);
    }
  }

  // Check which topic nodes and about edges already exist
  const existingTopicNodes = new Set();
  const existingAboutEdges = new Set();
  for (const node of await read.view.getNodes()) {
    if (node.startsWith(TOPIC_PREFIX)) {
      existingTopicNodes.add(node);
    }
  }
  for (const edge of edges) {
    if (edge.label === 'about') {
      existingAboutEdges.add(`${edge.from}\0${edge.to}`);
    }
  }

  // Check existing classified_as edges
  const existingClassifiedEdges = new Set();
  for (const edge of edges) {
    if (edge.label === 'classified_as') {
      existingClassifiedEdges.add(`${edge.from}\0${edge.to}`);
    }
  }

  // Check existing semantic_parse receipts
  const existingParseReceipts = new Set();
  for (const node of allNodes) {
    if (node.startsWith('artifact:')) {
      // eslint-disable-next-line no-await-in-loop -- sequential graph reads during enrichment scan
      const props = await read.view.getNodeProps(node);
      if (props?.kind === 'semantic_parse') {
        existingParseReceipts.add(props.primaryInputId);
      }
    }
  }

  // Run classification on all captures
  const thoughtClassifications = new Map();
  for (const capture of captures) {
    const { thoughtId } = capture;
    if (!thoughtId || thoughtClassifications.has(thoughtId)) { continue; }
    thoughtClassifications.set(thoughtId, classifyThought(capture.text));
  }

  const timestamp = getCurrentTime().toISOString();
  let topicNodesCreated = 0;
  let aboutEdgesAdded = 0;
  let classifiedEdgesAdded = 0;
  let receiptsCreated = 0;

  await app.patch((patch) => {
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

    // Create receipt artifacts for un-enriched thoughts
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
  });

  return Object.freeze({
    capturesProcessed: captures.length,
    topicNodesCreated,
    aboutEdgesAdded,
    classifiedEdgesAdded,
    receiptsCreated,
    promotedTopics: [...promotedTopics].sort(),
  });
}

/**
 * List all promoted topics in the graph with thought counts.
 */
export async function listTopics(repoDir) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const edges = await read.view.getEdges();
  const nodes = await read.view.getNodes();

  const topics = [];
  for (const nodeId of nodes) {
    if (!nodeId.startsWith(TOPIC_PREFIX)) { continue; }

    // eslint-disable-next-line no-await-in-loop -- sequential topic node reads
    const props = await read.view.getNodeProps(nodeId);
    if (!props || props.kind !== 'topic') { continue; }

    const thoughtCount = edges.filter(
      (e) => e.to === nodeId && e.label === 'about'
    ).length;

    topics.push(Object.freeze({
      name: props.name,
      thoughtCount,
      createdAt: props.createdAt,
    }));
  }

  return topics.sort((a, b) => b.thoughtCount - a.thoughtCount);
}
