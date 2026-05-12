import {
  ARTIFACT_PREFIX,
  CLASSIFICATION_PREFIX,
  CLASSIFICATIONS,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
} from './constants.js';
import { compareEntriesNewestFirst, getCurrentTime } from './model.js';
import { openWarpApp, patchWarpApp } from './runtime.js';

export async function migrateGraphModel(repoDir) {
  const app = await openWarpApp(repoDir);
  const worldline = app.worldline();

  // Check current graph model version
  const graphMeta = await worldline.getNodeProps(GRAPH_META_ID);
  const needsMetadataNode = !graphMeta;
  const needsGraphVersionUpdate = !graphMeta || graphMeta.graphModelVersion !== GRAPH_MODEL_VERSION;

  // Query each node kind separately — no full materialization
  const captureResult = await worldline.query().match('entry:*').where({ kind: 'capture' }).run();
  const reflectEntryResult = await worldline.query().match('entry:*').where({ kind: 'reflect' }).run();
  const brainstormEntryResult = await worldline.query().match('entry:*').where({ kind: 'brainstorm' }).run();
  const reflectKindNodes = [
    ...(reflectEntryResult.nodes ?? []),
    ...(brainstormEntryResult.nodes ?? []),
  ];
  const reflectSessionResult = await worldline.query().match('reflect:*').run();
  const brainstormSessionResult = await worldline.query().match('brainstorm:*').run();
  const sessionNodes = [
    ...(reflectSessionResult.nodes ?? []),
    ...(brainstormSessionResult.nodes ?? []),
  ];
  const sessionNodeIds = new Set(sessionNodes.map((node) => node.id));
  const artifactResult = await worldline.query().match(`${ARTIFACT_PREFIX}*`).run();

  const missingEdges = [];
  const removableEdges = [];
  const reflectNodes = new Map();
  addReflectNodes(reflectNodes, reflectKindNodes);

  for (const node of sessionNodes) {
    // eslint-disable-next-line no-await-in-loop -- sequential migration fallback query per reflect session
    const linkedReflectEntryResult = await worldline.query()
      .match('entry:*')
      .where({ sessionId: node.id })
      .run();
    addReflectNodes(reflectNodes, linkedReflectEntryResult.nodes);
  }

  // Check capture edges — sequential per-node edge traversal
  for (const node of captureResult.nodes ?? []) {
    const { id, props } = node;
    /* eslint-disable no-await-in-loop -- sequential migration edge checks */
    if (props.thoughtId) {
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, props.thoughtId, 'expresses');
    }
    if (props.sessionId) {
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, props.sessionId, 'captured_in');
    }
    /* eslint-enable no-await-in-loop */
  }

  // Check reflect session edges
  const seedEntryIdBySessionId = new Map();
  for (const node of sessionNodes) {
    const { id, props } = node;
    if (props.seedEntryId) {
      seedEntryIdBySessionId.set(id, props.seedEntryId);
      // eslint-disable-next-line no-await-in-loop -- sequential migration
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, props.seedEntryId, 'seeded_by');
    }
  }

  // Check reflect entry edges
  for (const node of reflectNodes.values()) {
    const { id, props } = node;
    const sessionId = props.sessionId ?? inferReflectSessionId(props, sessionNodes);
    const seedEntryId = props.seedEntryId ?? seedEntryIdBySessionId.get(sessionId);
    /* eslint-disable no-await-in-loop -- sequential migration edge checks */
    if (sessionId) {
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, sessionId, 'produced_in', {
        knownTargetNodeIds: sessionNodeIds,
      });
    }
    if (seedEntryId) {
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, seedEntryId, 'responds_to');
    }
    /* eslint-enable no-await-in-loop */
  }

  // Check artifact edges
  for (const node of artifactResult.nodes ?? []) {
    const { id, props } = node;
    /* eslint-disable no-await-in-loop -- sequential migration edge checks */
    if (props.primaryInputKind === 'thought' && props.primaryInputId) {
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, props.primaryInputId, 'derived_from');
    }
    if (props.primaryInputKind === 'capture' && props.primaryInputId) {
      await pushMissingEdgeIfAbsent(worldline, missingEdges, id, props.primaryInputId, 'contextualizes');
    }
    /* eslint-enable no-await-in-loop */
  }

  // Build chronology chain
  const captures = (captureResult.nodes ?? [])
    .map((node) => ({ id: node.id, sortKey: String(node.props.sortKey || '') }))
    .sort(compareEntriesNewestFirst);

  // Check latest_capture edge
  const latestCaptureId = captures[0]?.id ?? null;
  const latestCaptureTraversal = await worldline.query()
    .match(GRAPH_META_ID)
    .outgoing('latest_capture')
    .run();
  const currentLatestEdges = latestCaptureTraversal.nodes ?? [];

  for (const node of currentLatestEdges) {
    if (node.id !== latestCaptureId) {
      removableEdges.push({ from: GRAPH_META_ID, to: node.id, label: 'latest_capture' });
    }
  }
  if (latestCaptureId) {
    const hasLatest = currentLatestEdges.some((n) => n.id === latestCaptureId);
    if (!hasLatest) {
      missingEdges.push({ from: GRAPH_META_ID, to: latestCaptureId, label: 'latest_capture' });
    }
  }

  // Check older chain
  for (let index = 0; index + 1 < captures.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential chain check
    await pushMissingEdgeIfAbsent(worldline, missingEdges, captures[index].id, captures[index + 1].id, 'older');
  }

  // Check classification nodes
  const classificationNodesToCreate = [];
  for (const name of CLASSIFICATIONS) {
    const nodeId = `${CLASSIFICATION_PREFIX}${name}`;
    // eslint-disable-next-line no-await-in-loop -- checking 7 standing nodes
    const existing = await worldline.getNodeProps(nodeId);
    if (!existing) {
      classificationNodesToCreate.push({ nodeId, name });
    }
  }

  if (
    missingEdges.length === 0
    && removableEdges.length === 0
    && classificationNodesToCreate.length === 0
    && !needsMetadataNode
    && !needsGraphVersionUpdate
  ) {
    return Object.freeze({
      changed: false,
      graphModelVersion: GRAPH_MODEL_VERSION,
      edgesAdded: 0,
      edgesRemoved: 0,
      metadataUpdated: false,
    });
  }

  const timestamp = getCurrentTime().toISOString();
  await patchWarpApp(repoDir, (patch) => {
    if (needsMetadataNode) {
      patch
        .addNode(GRAPH_META_ID)
        .setProperty(GRAPH_META_ID, 'kind', 'graph_meta')
        .setProperty(GRAPH_META_ID, 'createdAt', timestamp);
    }

    patch
      .setProperty(GRAPH_META_ID, 'graphModelVersion', GRAPH_MODEL_VERSION)
      .setProperty(GRAPH_META_ID, 'updatedAt', timestamp);

    for (const edge of removableEdges) {
      patch.removeEdge(edge.from, edge.to, edge.label);
    }
    for (const edge of missingEdges) {
      patch.addEdge(edge.from, edge.to, edge.label);
    }

    for (const { nodeId, name } of classificationNodesToCreate) {
      patch
        .addNode(nodeId)
        .setProperty(nodeId, 'kind', 'classification')
        .setProperty(nodeId, 'name', name)
        .setProperty(nodeId, 'createdAt', timestamp);
    }
  });

  return Object.freeze({
    changed: true,
    graphModelVersion: GRAPH_MODEL_VERSION,
    edgesAdded: missingEdges.length,
    edgesRemoved: removableEdges.length,
    metadataUpdated: needsMetadataNode || needsGraphVersionUpdate,
  });
}

async function pushMissingEdgeIfAbsent(worldline, target, from, to, label, { knownTargetNodeIds = null } = {}) {
  // Verify target node exists before checking edge
  if (!knownTargetNodeIds?.has(to)) {
    const targetProps = await worldline.getNodeProps(to);
    if (!targetProps) { return; }
  }

  const traversal = await worldline.query().match(from).outgoing(label).run();
  const hasEdge = (traversal.nodes ?? []).some((n) => n.id === to);
  if (!hasEdge) {
    target.push({ from, to, label });
  }
}

function addReflectNodes(target, nodes = []) {
  for (const node of nodes ?? []) {
    if (!node?.id || !isReflectEntryProps(node.props ?? {})) {
      continue;
    }
    target.set(node.id, node);
  }
}

function isReflectEntryProps(props) {
  return props.kind === 'reflect'
    || props.kind === 'brainstorm'
    || props.source === 'reflect'
    || props.source === 'brainstorm'
    || typeof props.seedEntryId === 'string'
    || typeof props.promptType === 'string';
}

function inferReflectSessionId(reflectProps, sessionNodes) {
  const candidates = sessionNodes.filter(({ props }) => {
    if (reflectProps.seedEntryId && props.seedEntryId !== reflectProps.seedEntryId) {
      return false;
    }
    if (reflectProps.promptType && props.promptType && props.promptType !== reflectProps.promptType) {
      return false;
    }
    return true;
  });

  return candidates.length === 1 ? candidates[0].id : null;
}
