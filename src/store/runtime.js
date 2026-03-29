import Plumbing from '@git-stunts/plumbing';
import WarpApp, { GitGraphAdapter } from '@git-stunts/git-warp';

import {
  ARTIFACT_PREFIX,
  CHECKPOINT_POLICY,
  ENTRY_PREFIX,
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
  GRAPH_NAME,
  LEGACY_BRAINSTORM_SESSION_PREFIX,
  PRODUCT_READ_LENS,
  REFLECT_SESSION_PREFIX,
  SESSION_PREFIX,
  THOUGHT_PREFIX,
} from './constants.js';
import {
  compareEntriesNewestFirst,
  compareEntriesOldestFirst,
  createWriterId,
  storesTextContent,
} from './model.js';

export async function openWarpApp(repoDir) {
  const plumbing = Plumbing.createDefault({ cwd: repoDir });
  const persistence = new GitGraphAdapter({ plumbing });

  return WarpApp.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
    checkpointPolicy: CHECKPOINT_POLICY,
  });
}

export async function createProductReadHandle(app) {
  const worldline = app.worldline();
  const view = await worldline.observer('think-product', PRODUCT_READ_LENS);

  return {
    app,
    worldline,
    view,
    contentCore: app.core(),
    writerId: app.writerId,
  };
}

export async function openProductReadHandle(repoDir) {
  const app = await openWarpApp(repoDir);
  return createProductReadHandle(app);
}

export async function getGraphModelStatusForRead(read) {
  const latestCaptureId = await getLatestCaptureId(read);
  if (!latestCaptureId) {
    return {
      currentGraphModelVersion: 1,
      requiredGraphModelVersion: GRAPH_MODEL_VERSION,
      migrationRequired: true,
    };
  }

  const props = await read.view.getNodeProps(GRAPH_META_ID);
  const currentGraphModelVersion = Number(props?.graphModelVersion ?? 1);

  return {
    currentGraphModelVersion,
    requiredGraphModelVersion: GRAPH_MODEL_VERSION,
    migrationRequired: currentGraphModelVersion < GRAPH_MODEL_VERSION,
  };
}

export async function getStoredEntry(read, nodeId, props = null) {
  const resolvedProps = props ?? await read.view.getNodeProps(nodeId);
  if (!resolvedProps) {
    return null;
  }

  const kind = resolvedProps.kind;

  return {
    id: nodeId,
    kind,
    source: resolvedProps.source,
    channel: resolvedProps.channel,
    writerId: resolvedProps.writerId,
    createdAt: resolvedProps.createdAt,
    sortKey: String(resolvedProps.sortKey || ''),
    thoughtId: resolvedProps.thoughtId ?? null,
    seedEntryId: resolvedProps.seedEntryId ?? null,
    contrastEntryId: resolvedProps.contrastEntryId ?? null,
    sessionId: resolvedProps.sessionId ?? null,
    promptType: resolvedProps.promptType ?? null,
    question: resolvedProps.question ?? null,
    ambientCwd: resolvedProps.ambientCwd ?? null,
    ambientGitRoot: resolvedProps.ambientGitRoot ?? null,
    ambientGitRemote: resolvedProps.ambientGitRemote ?? null,
    ambientGitBranch: resolvedProps.ambientGitBranch ?? null,
    selectionReason: resolvedProps.selectionReasonKind
      ? {
          kind: resolvedProps.selectionReasonKind,
          text: resolvedProps.selectionReasonText ?? '',
        }
      : null,
    stepCount: Number(resolvedProps.stepCount ?? 0),
    maxSteps: Number(resolvedProps.maxSteps ?? 0),
    text: storesTextContent(kind) ? await readNodeText(read, nodeId) : '',
  };
}

export async function toBrowseEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    sessionId: entry.sessionId ?? null,
  };
}

export async function getReflectSession(read, sessionId) {
  const session = await getStoredEntry(read, sessionId);
  if (!session || (session.kind !== 'reflect_session' && session.kind !== 'brainstorm_session')) {
    return null;
  }

  return session;
}

export async function listEntriesByKind(read, kind) {
  const result = await read.view.query()
    .match(getMatchPatternsForKind(kind))
    .where({ kind })
    .run();

  const entries = [];
  for (const node of result.nodes ?? []) {
    const entry = await getStoredEntry(read, node.id, node.props ?? null);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function getMatchPatternsForKind(kind) {
  if (kind === 'capture' || kind === 'reflect') {
    return `${ENTRY_PREFIX}*`;
  }
  if (kind === 'reflect_session' || kind === 'brainstorm_session') {
    return [`${REFLECT_SESSION_PREFIX}*`, `${LEGACY_BRAINSTORM_SESSION_PREFIX}*`];
  }
  if (kind === 'session') {
    return `${SESSION_PREFIX}*`;
  }
  if (kind === 'seed_quality' || kind === 'session_attribution') {
    return `${ARTIFACT_PREFIX}*`;
  }
  if (kind === 'thought') {
    return `${THOUGHT_PREFIX}*`;
  }
  if (kind === 'graph_meta') {
    return GRAPH_META_ID;
  }
  return PRODUCT_READ_LENS.match;
}

export async function listChronologyEntries(read) {
  const latestCaptureId = await getLatestCaptureId(read);
  if (!latestCaptureId) {
    const captures = await listEntriesByKind(read, 'capture');
    return captures
      .map((entry) => ({
        id: entry.id,
        text: entry.text,
        sortKey: entry.sortKey,
        createdAt: entry.createdAt,
        sessionId: entry.sessionId ?? null,
      }))
      .sort(compareEntriesNewestFirst);
  }

  const chronologyIds = await read.view.traverse.bfs(latestCaptureId, {
    dir: 'out',
    labelFilter: 'older',
  });
  const entries = [];
  for (const currentId of chronologyIds) {
    const entry = await getStoredEntry(read, currentId);
    if (!entry || entry.kind !== 'capture') {
      continue;
    }

    entries.push(await toBrowseEntry(entry));
  }

  return entries;
}

export async function getSingleNeighborId(read, nodeId, direction, label) {
  const query = read.view.query().match(nodeId);
  const result = direction === 'incoming'
    ? await query.incoming(label).run()
    : await query.outgoing(label).run();
  return result.nodes?.[0]?.id ?? null;
}

export async function readNodeText(read, nodeId) {
  const content = await read.contentCore.getContent(nodeId);
  return content ? new TextDecoder().decode(content) : '';
}

export async function getLatestCaptureId(read) {
  const result = await read.view.query()
    .match(GRAPH_META_ID)
    .outgoing('latest_capture')
    .run();
  return result.nodes?.[0]?.id ?? null;
}

export async function getProducedInSessionId(read, entry) {
  const result = await read.view.query()
    .match(entry.id)
    .outgoing('produced_in')
    .run();
  return result.nodes?.[0]?.id ?? entry.sessionId ?? null;
}

export async function hasNode(read, nodeId) {
  return read.view.hasNode(nodeId);
}

export async function resolveGraphSessionTraversal(read, entry) {
  if (!entry?.sessionId) {
    return {
      entries: [],
      sessionCount: 0,
      sessionPosition: null,
      previous: null,
      next: null,
    };
  }

  const neighbors = await read.view.query()
    .match(entry.sessionId)
    .incoming('captured_in')
    .run();
  const sessionEntries = [];

  for (const neighbor of neighbors.nodes ?? []) {
    const capture = await getStoredEntry(read, neighbor.id, neighbor.props ?? null);
    if (!capture || capture.kind !== 'capture') {
      continue;
    }
    sessionEntries.push(await toBrowseEntry(capture));
  }

  sessionEntries.sort(compareEntriesOldestFirst);
  const sessionIndex = sessionEntries.findIndex((candidate) => candidate.id === entry.id);

  if (sessionIndex === -1) {
    return {
      entries: sessionEntries,
      sessionCount: sessionEntries.length,
      sessionPosition: null,
      previous: null,
      next: null,
    };
  }

  return {
    entries: sessionEntries,
    sessionCount: sessionEntries.length,
    sessionPosition: sessionIndex + 1,
    previous: sessionIndex > 0 ? sessionEntries[sessionIndex - 1] : null,
    next: sessionIndex + 1 < sessionEntries.length ? sessionEntries[sessionIndex + 1] : null,
  };
}
