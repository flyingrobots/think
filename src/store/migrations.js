import {
  ARTIFACT_PREFIX,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
} from './constants.js';
import { compareEntriesNewestFirst, getCurrentTime } from './model.js';
import { openWarpApp } from './runtime.js';

export async function migrateGraphModel(repoDir) {
  const app = await openWarpApp(repoDir);
  const graph = app.core();
  const nodes = await graph.getNodes();
  const edges = await graph.getEdges();
  const edgeKeys = new Set(edges.map(edge => `${edge.from}\0${edge.to}\0${edge.label}`));
  const propsById = new Map();

  for (const nodeId of nodes) {
    // eslint-disable-next-line no-await-in-loop -- sequential graph node reads during migration
    const props = await graph.getNodeProps(nodeId);
    if (props) {
      propsById.set(nodeId, props);
    }
  }

  const missingEdges = [];
  const removableEdges = [];
  for (const [nodeId, props] of propsById) {
    if (props.kind === 'capture') {
      if (typeof props.thoughtId === 'string' && props.thoughtId !== '' && propsById.has(props.thoughtId)) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.thoughtId, 'expresses');
      }
      if (typeof props.sessionId === 'string' && props.sessionId !== '' && propsById.has(props.sessionId)) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.sessionId, 'captured_in');
      }
    }

    if (props.kind === 'reflect_session' || props.kind === 'brainstorm_session') {
      if (typeof props.seedEntryId === 'string' && props.seedEntryId !== '' && propsById.has(props.seedEntryId)) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.seedEntryId, 'seeded_by');
      }
    }

    if (props.kind === 'reflect') {
      if (typeof props.sessionId === 'string' && props.sessionId !== '' && propsById.has(props.sessionId)) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.sessionId, 'produced_in');
      }
      if (typeof props.seedEntryId === 'string' && props.seedEntryId !== '' && propsById.has(props.seedEntryId)) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.seedEntryId, 'responds_to');
      }
    }

    if (String(nodeId).startsWith(ARTIFACT_PREFIX)) {
      if (
        props.primaryInputKind === 'thought'
        && typeof props.primaryInputId === 'string'
        && propsById.has(props.primaryInputId)
      ) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.primaryInputId, 'derived_from');
      }

      if (
        props.primaryInputKind === 'capture'
        && typeof props.primaryInputId === 'string'
        && propsById.has(props.primaryInputId)
      ) {
        pushMissingEdge(missingEdges, edgeKeys, nodeId, props.primaryInputId, 'contextualizes');
      }
    }
  }

  const captures = [...propsById.entries()]
    .filter(([, props]) => props.kind === 'capture')
    .map(([nodeId, props]) => ({
      id: nodeId,
      sortKey: String(props.sortKey || ''),
    }))
    .sort(compareEntriesNewestFirst);

  const latestCaptureEdges = edges.filter((edge) => edge.from === GRAPH_META_ID && edge.label === 'latest_capture');
  const latestCaptureId = captures[0]?.id ?? null;
  for (const edge of latestCaptureEdges) {
    if (edge.to !== latestCaptureId) {
      removableEdges.push(edge);
      edgeKeys.delete(`${edge.from}\0${edge.to}\0${edge.label}`);
    }
  }
  if (latestCaptureId) {
    pushMissingEdge(missingEdges, edgeKeys, GRAPH_META_ID, latestCaptureId, 'latest_capture');
  }

  for (let index = 0; index + 1 < captures.length; index += 1) {
    pushMissingEdge(missingEdges, edgeKeys, captures[index].id, captures[index + 1].id, 'older');
  }

  const graphMeta = propsById.get(GRAPH_META_ID) ?? null;
  const needsMetadataNode = !graphMeta;
  const needsGraphVersionUpdate = graphMeta?.graphModelVersion !== GRAPH_MODEL_VERSION;

  if (missingEdges.length === 0 && removableEdges.length === 0 && !needsMetadataNode && !needsGraphVersionUpdate) {
    return {
      changed: false,
      graphModelVersion: GRAPH_MODEL_VERSION,
      edgesAdded: 0,
      edgesRemoved: 0,
      metadataUpdated: false,
    };
  }

  const timestamp = getCurrentTime().toISOString();
  await graph.patch((patch) => {
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
  });

  return {
    changed: true,
    graphModelVersion: GRAPH_MODEL_VERSION,
    edgesAdded: missingEdges.length,
    edgesRemoved: removableEdges.length,
    metadataUpdated: needsMetadataNode || needsGraphVersionUpdate,
  };
}

function pushMissingEdge(target, existingEdgeKeys, from, to, label) {
  const key = `${from}\0${to}\0${label}`;
  if (existingEdgeKeys.has(key)) {
    return;
  }

  existingEdgeKeys.add(key);
  target.push({ from, to, label });
}
