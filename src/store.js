import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';

import Plumbing from '@git-stunts/plumbing';
import WarpApp, { GitGraphAdapter } from '@git-stunts/git-warp';
import { buildQueryTerms, getAmbientProjectContext } from './project-context.js';

export const GRAPH_NAME = 'think';
export const REFLECT_PROMPT_TYPES = ['challenge', 'constraint', 'sharpen'];
const ENTRY_PREFIX = 'entry:';
const THOUGHT_PREFIX = 'thought:';
const SESSION_PREFIX = 'session:';
const ARTIFACT_PREFIX = 'artifact:';
const REFLECT_SESSION_PREFIX = 'reflect:';
const LEGACY_BRAINSTORM_SESSION_PREFIX = 'brainstorm:';
const GRAPH_META_ID = 'meta:graph';
const TEXT_MIME = 'text/plain; charset=utf-8';
const MAX_REFLECT_STEPS = 3;
const SESSION_IDLE_GAP_MS = 5 * 60 * 1000;
const DERIVER_NAME = 'think';
const DERIVER_VERSION = '1';
const SCHEMA_VERSION = '1';
const GRAPH_MODEL_VERSION = 3;
const CHECKPOINT_POLICY = { every: 20 };
const PRODUCT_READ_LENS = {
  match: [
    GRAPH_META_ID,
    `${ENTRY_PREFIX}*`,
    `${THOUGHT_PREFIX}*`,
    `${SESSION_PREFIX}*`,
    `${ARTIFACT_PREFIX}*`,
    `${REFLECT_SESSION_PREFIX}*`,
    `${LEGACY_BRAINSTORM_SESSION_PREFIX}*`,
  ],
};
const CHALLENGE_PROMPTS = [
  'What assumption is hiding here?',
  'What would make this false in practice?',
  'What part of this is probably wishful thinking?',
];
const CONSTRAINT_PROMPTS = [
  'What if this had to work offline?',
  'What is the smallest shippable version of this?',
  'What if this had to be explained in one sentence?',
];
const SHARPEN_PROMPTS = [
  'What is the actual core claim here?',
  'What is the smallest concrete next move?',
  'What should be cut from this idea?',
];
const REFLECT_MARKERS = [
  /\?/,
  /\b(i wonder|maybe|should|could|would|what if|how might|want to|need to|problem|question|decision|tradeoff|constraint|risk)\b/,
];

export async function saveRawCapture(repoDir, thought) {
  const app = await openWarpApp(repoDir);
  const entry = createEntry(thought, app.writerId, { kind: 'capture', source: 'capture' });
  const ambientContext = getAmbientProjectContext(process.cwd());

  await app.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey);

    if (ambientContext.cwd) {
      patch.setProperty(entry.id, 'ambientCwd', ambientContext.cwd);
    }
    if (ambientContext.gitRoot) {
      patch.setProperty(entry.id, 'ambientGitRoot', ambientContext.gitRoot);
    }
    if (ambientContext.gitRemote) {
      patch.setProperty(entry.id, 'ambientGitRemote', ambientContext.gitRemote);
    }
    if (ambientContext.gitBranch) {
      patch.setProperty(entry.id, 'ambientGitBranch', ambientContext.gitBranch);
    }

    await patch.attachContent(entry.id, thought, { mime: TEXT_MIME });
  });

  return entry;
}

export async function finalizeCapturedThought(repoDir, entryId, { migrateIfNeeded = false } = {}) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return {
      entry: null,
      migration: null,
    };
  }

  await ensureFirstDerivedArtifacts(app, read, entry);
  await ensureCaptureReadEdges(app, read, entryId);
  entry = await getStoredEntry(read, entryId);

  return {
    entry,
    migration: migrateIfNeeded ? await migrateGraphModel(repoDir) : null,
  };
}

export async function getGraphModelStatus(repoDir) {
  const read = await openProductReadHandle(repoDir);
  return getGraphModelStatusForRead(read);
}

export async function migrateGraphModel(repoDir) {
  const app = await openWarpApp(repoDir);
  const graph = app.core();
  const nodes = await graph.getNodes();
  const edges = await graph.getEdges();
  const edgeKeys = new Set(edges.map(edge => `${edge.from}\0${edge.to}\0${edge.label}`));
  const propsById = new Map();

  for (const nodeId of nodes) {
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

export async function rememberThoughts(
  repoDir,
  {
    cwd = process.cwd(),
    query = null,
    limit = null,
    brief = false,
  } = {}
) {
  const read = await openProductReadHandle(repoDir);
  const captures = (await listEntriesByKind(read, 'capture'))
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      ambientCwd: entry.ambientCwd ?? null,
      ambientGitRoot: entry.ambientGitRoot ?? null,
      ambientGitRemote: entry.ambientGitRemote ?? null,
      ambientGitBranch: entry.ambientGitBranch ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  if (query && String(query).trim() !== '') {
    const scope = buildExplicitRememberScope(query);
    const matches = captures
      .map((entry) => buildExplicitRememberMatch(entry, scope))
      .filter(Boolean)
      .sort(compareRememberMatches);
    return {
      scope: {
        ...scope,
        brief,
        limit,
      },
      matches: finalizeRememberMatches(matches, { brief, limit }),
    };
  }

  const scope = buildAmbientRememberScope(cwd);
  const matches = captures
    .map((entry) => buildAmbientRememberMatch(entry, scope))
    .filter(Boolean)
    .sort(compareRememberMatches);
  return {
    scope: {
      ...scope,
      brief,
      limit,
    },
    matches: finalizeRememberMatches(matches, { brief, limit }),
  };
}

export async function startReflect(repoDir, seedEntryId, { promptType = null } = {}) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const planned = await planReflect(read, seedEntryId, { promptType });

  if (!planned.ok) {
    return planned;
  }

  const promptPlan = planned.promptPlan;
  const session = createReflectSession(app.writerId, {
    seedEntryId,
    contrastEntryId: null,
    promptType: promptPlan.promptType,
    question: promptPlan.question,
    selectionReason: promptPlan.selectionReason,
  });

  await app.patch(async patch => {
    patch
      .addNode(session.id)
      .setProperty(session.id, 'kind', session.kind)
      .setProperty(session.id, 'source', session.source)
      .setProperty(session.id, 'channel', session.channel)
      .setProperty(session.id, 'writerId', session.writerId)
      .setProperty(session.id, 'createdAt', session.createdAt)
      .setProperty(session.id, 'sortKey', session.sortKey)
      .setProperty(session.id, 'seedEntryId', session.seedEntryId)
      .setProperty(session.id, 'promptType', session.promptType)
      .setProperty(session.id, 'question', session.question)
      .setProperty(session.id, 'selectionReasonKind', session.selectionReason.kind)
      .setProperty(session.id, 'selectionReasonText', session.selectionReason.text)
      .setProperty(session.id, 'maxSteps', session.maxSteps)
      .setProperty(session.id, 'stepCount', 0);

    patch.addEdge(session.id, session.seedEntryId, 'seeded_by');

    if (session.contrastEntryId) {
      patch.setProperty(session.id, 'contrastEntryId', session.contrastEntryId);
    }
  });

  return {
    ok: true,
    sessionId: session.id,
    seedEntryId: session.seedEntryId,
    contrastEntryId: session.contrastEntryId,
    promptType: session.promptType,
    question: session.question,
    maxSteps: session.maxSteps,
    selectionReason: session.selectionReason,
    seedEntry: planned.seedEntry,
    contrastEntry: null,
  };
}

export async function previewReflect(repoDir, seedEntryId, { promptType = null } = {}) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const planned = await planReflect(read, seedEntryId, { promptType });

  if (!planned.ok) {
    return planned;
  }

  return {
    ok: true,
    seedEntryId,
    contrastEntryId: null,
    promptType: planned.promptPlan.promptType,
    question: planned.promptPlan.question,
    maxSteps: MAX_REFLECT_STEPS,
    selectionReason: planned.promptPlan.selectionReason,
    seedEntry: planned.seedEntry,
    contrastEntry: null,
  };
}

export async function saveReflectResponse(repoDir, sessionId, response) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  const session = await getReflectSession(read, sessionId);

  if (!session) {
    return null;
  }

  const entry = createEntry(response, app.writerId, {
    kind: 'reflect',
    source: 'reflect',
  });

  entry.seedEntryId = session.seedEntryId;
  entry.contrastEntryId = session.contrastEntryId;
  entry.sessionId = session.id;
  entry.promptType = session.promptType;

  await app.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey)
      .setProperty(entry.id, 'seedEntryId', entry.seedEntryId)
      .setProperty(entry.id, 'sessionId', entry.sessionId)
      .setProperty(entry.id, 'promptType', entry.promptType);

    patch
      .addEdge(entry.id, entry.sessionId, 'produced_in')
      .addEdge(entry.id, entry.seedEntryId, 'responds_to');

    if (entry.contrastEntryId) {
      patch.setProperty(entry.id, 'contrastEntryId', entry.contrastEntryId);
    }

    patch
      .setProperty(session.id, 'stepCount', session.stepCount + 1)
      .setProperty(session.id, 'updatedAt', entry.createdAt);

    await patch.attachContent(entry.id, response, { mime: TEXT_MIME });
  });

  return entry;
}

export async function getStats(repoDir, { from, to, since, bucket } = {}) {
  const read = await openProductReadHandle(repoDir);
  const entries = [];

  const now = getCurrentTime();
  const sinceDate = since ? parseSince(since, now) : null;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (toDate && to.length <= 10) {
    toDate.setUTCHours(23, 59, 59, 999);
  }

  for (const entry of await listEntriesByKind(read, 'capture')) {
    const createdAt = new Date(entry.createdAt);

    if (sinceDate && createdAt < sinceDate) continue;
    if (fromDate && createdAt < fromDate) continue;
    if (toDate && createdAt > toDate) continue;

    entries.push({ createdAt });
  }

  if (!bucket) {
    return { total: entries.length };
  }

  const buckets = {};
  for (const entry of entries) {
    const key = formatBucketKey(entry.createdAt, bucket);
    buckets[key] = (buckets[key] || 0) + 1;
  }

  return {
    total: entries.length,
    buckets: Object.entries(buckets)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({ key, count })),
  };
}

export async function listRecent(repoDir, { count = null, query = null } = {}) {
  const read = await openProductReadHandle(repoDir);
  const captures = await listEntriesByKind(read, 'capture');

  const recent = captures
    .map(entry => ({
      id: entry.id,
      text: entry.text,
      sortKey: entry.sortKey,
      createdAt: entry.createdAt,
      sessionId: entry.sessionId ?? null,
    }))
    .sort(compareEntriesNewestFirst);

  const filtered = query
    ? recent.filter((entry) => matchesRecentQuery(entry.text, query))
    : recent;

  if (count == null) {
    return filtered;
  }

  return filtered.slice(0, count);
}

export async function listReflectableRecent(repoDir) {
  const recent = await listRecent(repoDir);
  return recent.filter((entry) => assessReflectability(entry.text).eligible);
}

export async function loadBrowseChronologyEntries(repoDir) {
  const read = await openProductReadHandle(repoDir);
  return loadBrowseChronologyEntriesForRead(read);
}

export async function prepareBrowseBootstrap(repoDir) {
  const read = await openProductReadHandle(repoDir);
  return prepareBrowseBootstrapForRead(read);
}

export async function getBrowseWindow(repoDir, entryId) {
  const read = await openProductReadHandle(repoDir);
  return getBrowseWindowForRead(read, entryId);
}

export async function inspectRawEntry(repoDir, entryId) {
  const read = await openProductReadHandle(repoDir);
  return inspectRawEntryForRead(read, entryId);
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

export async function loadBrowseChronologyEntriesForRead(read) {
  return listChronologyEntries(read);
}

export async function prepareBrowseBootstrapForRead(read) {
  const latestCaptureId = await getLatestCaptureId(read);
  if (!latestCaptureId) {
    return {
      ok: false,
      reason: 'no_entries',
      current: null,
      newer: null,
      older: null,
      sessionContext: null,
      sessionEntries: [],
      sessionSteps: [],
    };
  }

  const window = await buildBrowseWindow(read, latestCaptureId);
  if (!window) {
    return {
      ok: false,
      reason: 'entry_not_found',
      current: null,
      newer: null,
      older: null,
      sessionContext: null,
      sessionEntries: [],
      sessionSteps: [],
    };
  }

  return {
    ok: true,
    ...window,
  };
}

export async function getBrowseWindowForRead(read, entryId) {
  return buildBrowseWindow(read, entryId);
}

export async function inspectRawEntryForRead(read, entryId) {
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return null;
  }

  await ensureFirstDerivedArtifacts(read.app, read, entry);
  entry = await getStoredEntry(read, entryId);

  const canonicalThought = await getCanonicalThought(read, entry);
  const seedQuality = await getSeedQualityReceipt(read, entry);
  const sessionAttribution = await getSessionAttributionReceipt(read, entry);
  const derivedReceipts = await listDirectDerivedReceipts(read, entryId);

  return {
    entryId: entry.id,
    thoughtId: canonicalThought?.thoughtId ?? createThoughtId(entry.text),
    kind: 'raw_capture',
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    canonicalThought,
    seedQuality,
    sessionAttribution,
    derivedReceipts,
  };
}

export function assessReflectability(text) {
  const seedQuality = deriveSeedQuality(createThoughtId(text), text);

  if (seedQuality.verdict === 'likely_reflectable') {
    return {
      eligible: true,
      kind: 'pressure_testable',
      text: 'This entry looks like a candidate idea, question, or decision that can be pressure-tested.',
    };
  }

  return {
    eligible: false,
    kind: 'not_pressure_testable',
    text: 'This entry looks more like a note than a pressure-testable idea.',
    suggestion: 'Pick a different seed or capture a sharper claim first.',
  };
}

async function openWarpApp(repoDir) {
  const plumbing = Plumbing.createDefault({ cwd: repoDir });
  const persistence = new GitGraphAdapter({ plumbing });

  return WarpApp.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId: createWriterId(),
    checkpointPolicy: CHECKPOINT_POLICY,
  });
}

async function createProductReadHandle(app) {
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

async function getStoredEntry(read, nodeId, props = null) {
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

function storesTextContent(kind) {
  return kind === 'capture' || kind === 'reflect' || kind === 'thought';
}

async function toBrowseEntry(entry) {
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

async function getReflectSession(read, sessionId) {
  const session = await getStoredEntry(read, sessionId);
  if (!session || (session.kind !== 'reflect_session' && session.kind !== 'brainstorm_session')) {
    return null;
  }

  return session;
}

async function listEntriesByKind(read, kind) {
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

async function listChronologyEntries(read) {
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

async function buildBrowseWindow(read, entryId) {
  const currentEntry = await getStoredEntry(read, entryId);

  if (!currentEntry || currentEntry.kind !== 'capture') {
    return null;
  }

  const current = await toBrowseEntry(currentEntry);
  const olderEntryId = await getSingleNeighborId(read, entryId, 'outgoing', 'older');
  const newerEntryId = await getSingleNeighborId(read, entryId, 'incoming', 'older');
  const older = olderEntryId ? await toBrowseEntry(await getStoredEntry(read, olderEntryId)) : null;
  const newer = newerEntryId ? await toBrowseEntry(await getStoredEntry(read, newerEntryId)) : null;
  const sessionAttribution = await getSessionAttributionReceiptIfPresent(read, currentEntry);
  const sessionTraversal = await resolveGraphSessionTraversal(read, current);

  return {
    current,
    newer,
    older,
    sessionContext: sessionAttribution
      ? {
          entryId,
          sessionId: sessionAttribution.sessionId,
          reasonKind: sessionAttribution.reasonKind,
          reasonText: sessionAttribution.reasonText,
          sessionPosition: sessionTraversal.sessionPosition,
          sessionCount: sessionTraversal.sessionCount,
        }
      : null,
    sessionEntries: sessionTraversal.entries
      .filter((entry) => entry.id !== entryId)
      .sort(compareEntriesNewestFirst),
    sessionSteps: sessionAttribution
      ? [
          ...(sessionTraversal.previous
            ? [{
                direction: 'previous',
                ...sessionTraversal.previous,
                sessionPosition: sessionTraversal.sessionPosition - 1,
              }]
            : []),
          ...(sessionTraversal.next
            ? [{
                direction: 'next',
                ...sessionTraversal.next,
                sessionPosition: sessionTraversal.sessionPosition + 1,
              }]
            : []),
        ]
      : [],
  };
}

async function listDirectDerivedReceipts(read, seedEntryId) {
  const receipts = [];
  const seenEntryIds = new Set();
  const graphNativeNeighbors = await read.view.query()
    .match(seedEntryId)
    .incoming('responds_to')
    .run();

  for (const neighbor of graphNativeNeighbors.nodes ?? []) {
    const entry = await getStoredEntry(read, neighbor.id, neighbor.props ?? null);
    if (!entry || entry.kind !== 'reflect' || seenEntryIds.has(entry.id)) {
      continue;
    }

    seenEntryIds.add(entry.id);
    receipts.push({
      relation: 'seed_of',
      kind: entry.kind,
      entryId: entry.id,
      sessionId: await getProducedInSessionId(read, entry),
      promptType: entry.promptType,
      createdAt: entry.createdAt,
      sortKey: entry.sortKey,
    });
  }

  const reflectEntries = await listEntriesByKind(read, 'reflect');
  for (const entry of reflectEntries) {
    if (entry.seedEntryId !== seedEntryId || seenEntryIds.has(entry.id)) {
      continue;
    }

    receipts.push({
      relation: 'seed_of',
      kind: entry.kind,
      entryId: entry.id,
      sessionId: entry.sessionId,
      promptType: entry.promptType,
      createdAt: entry.createdAt,
      sortKey: entry.sortKey,
    });
  }

  return receipts
    .sort(compareEntriesNewestFirst)
    .map(({ sortKey, ...receipt }) => receipt);
}

async function getSingleNeighborId(read, nodeId, direction, label) {
  const query = read.view.query().match(nodeId);
  const result = direction === 'incoming'
    ? await query.incoming(label).run()
    : await query.outgoing(label).run();
  return result.nodes?.[0]?.id ?? null;
}

async function readNodeText(read, nodeId) {
  const content = await read.contentCore.getContent(nodeId);
  return content ? new TextDecoder().decode(content) : '';
}

function createEntry(text, writerId, { kind, source }) {
  const timestamp = getCurrentTime();
  const unique = randomUUID();
  const createdAt = timestamp.toISOString();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;

  return {
    id: `${ENTRY_PREFIX}${sortKey}`,
    kind,
    source,
    channel: 'cli',
    writerId,
    createdAt,
    sortKey,
    text,
  };
}

function createReflectSession(writerId, {
  seedEntryId,
  contrastEntryId,
  promptType,
  question,
  selectionReason,
}) {
  const timestamp = getCurrentTime();
  const createdAt = timestamp.toISOString();
  const unique = randomUUID();
  const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;

  return {
    id: `${REFLECT_SESSION_PREFIX}${unique}`,
    kind: 'reflect_session',
    source: 'reflect',
    channel: 'cli',
    writerId,
    createdAt,
    sortKey,
    seedEntryId,
    contrastEntryId,
    promptType,
    question,
    selectionReason,
    maxSteps: MAX_REFLECT_STEPS,
  };
}

async function ensureFirstDerivedArtifacts(app, read, entry) {
  if (!entry || entry.kind !== 'capture') {
    return null;
  }

  const thoughtId = createThoughtId(entry.text);
  const seedQuality = deriveSeedQuality(thoughtId, entry.text);
  const sessionAttribution = await deriveSessionAttribution(read, entry);

  const [
    thoughtNodeExists,
    seedQualityExists,
    sessionNodeExists,
    sessionArtifactExists,
    entryProps,
    graphMetaProps,
  ] = await Promise.all([
    hasNode(read, thoughtId),
    hasNode(read, seedQuality.artifactId),
    hasNode(read, sessionAttribution.sessionId),
    hasNode(read, sessionAttribution.artifactId),
    read.view.getNodeProps(entry.id),
    read.view.getNodeProps(GRAPH_META_ID),
  ]);

  const needsCaptureThoughtLink = entryProps?.thoughtId !== thoughtId;
  const needsCaptureSessionLink = entryProps?.sessionId !== sessionAttribution.sessionId;
  const needsGraphMetadata = !graphMetaProps || graphMetaProps.graphModelVersion !== GRAPH_MODEL_VERSION;

  if (
    thoughtNodeExists
    && seedQualityExists
    && sessionNodeExists
    && sessionArtifactExists
    && !needsCaptureThoughtLink
    && !needsCaptureSessionLink
    && !needsGraphMetadata
  ) {
    return {
      thoughtId,
      seedQuality,
      sessionAttribution,
    };
  }

  await app.patch(async (patch) => {
    ensureGraphMetadataNode(patch, graphMetaProps);

    if (!thoughtNodeExists) {
      patch
        .addNode(thoughtId)
        .setProperty(thoughtId, 'kind', 'thought')
        .setProperty(thoughtId, 'fingerprint', thoughtId.slice(THOUGHT_PREFIX.length))
        .setProperty(thoughtId, 'createdAt', entry.createdAt)
        .setProperty(thoughtId, 'schemaVersion', SCHEMA_VERSION);

      await patch.attachContent(thoughtId, entry.text, { mime: TEXT_MIME });
    }

    if (needsCaptureThoughtLink) {
      patch.setProperty(entry.id, 'thoughtId', thoughtId);
    }
    patch.addEdge(entry.id, thoughtId, 'expresses');

    if (!seedQualityExists) {
      addArtifactNode(patch, seedQuality);
    }

    if (!sessionNodeExists) {
      patch
        .addNode(sessionAttribution.sessionId)
        .setProperty(sessionAttribution.sessionId, 'kind', 'session')
        .setProperty(sessionAttribution.sessionId, 'createdAt', sessionAttribution.sessionCreatedAt)
        .setProperty(sessionAttribution.sessionId, 'startSortKey', sessionAttribution.sessionStartSortKey)
        .setProperty(sessionAttribution.sessionId, 'schemaVersion', SCHEMA_VERSION);
    }

    if (needsCaptureSessionLink) {
      patch.setProperty(entry.id, 'sessionId', sessionAttribution.sessionId);
    }
    patch.addEdge(entry.id, sessionAttribution.sessionId, 'captured_in');

    if (!sessionArtifactExists) {
      addArtifactNode(patch, sessionAttribution);
    }
  });

  return {
    thoughtId,
    seedQuality,
    sessionAttribution,
  };
}

async function ensureCaptureReadEdges(app, read, entryId) {
  const entry = await getStoredEntry(read, entryId);
  if (!entry || entry.kind !== 'capture') {
    return;
  }

  const latestCaptureId = await getLatestCaptureId(read);
  if (latestCaptureId === entry.id) {
    return;
  }

  const latestEntry = latestCaptureId ? await getStoredEntry(read, latestCaptureId) : null;
  if (latestEntry && compareEntriesNewestFirst(entry, latestEntry) >= 0) {
    return;
  }

  const latestCaptureNodes = await read.view.query()
    .match(GRAPH_META_ID)
    .outgoing('latest_capture')
    .run();

  await app.patch((patch) => {
    for (const node of latestCaptureNodes.nodes ?? []) {
      patch.removeEdge(GRAPH_META_ID, node.id, 'latest_capture');
    }

    patch.addEdge(GRAPH_META_ID, entry.id, 'latest_capture');
    if (latestEntry) {
      patch.addEdge(entry.id, latestEntry.id, 'older');
    }
  });
}

function addArtifactNode(patch, artifact) {
  patch
    .addNode(artifact.artifactId)
    .setProperty(artifact.artifactId, 'kind', artifact.kind)
    .setProperty(artifact.artifactId, 'primaryInputKind', artifact.primaryInputKind)
    .setProperty(artifact.artifactId, 'primaryInputId', artifact.primaryInputId)
    .setProperty(artifact.artifactId, 'deriver', artifact.deriver)
    .setProperty(artifact.artifactId, 'deriverVersion', artifact.deriverVersion)
    .setProperty(artifact.artifactId, 'schemaVersion', artifact.schemaVersion)
    .setProperty(artifact.artifactId, 'createdAt', artifact.createdAt);

  if (artifact.kind === 'seed_quality') {
    patch
      .setProperty(artifact.artifactId, 'verdict', artifact.verdict)
      .setProperty(artifact.artifactId, 'reasonKind', artifact.reasonKind)
      .setProperty(artifact.artifactId, 'reasonText', artifact.reasonText)
      .setProperty(artifact.artifactId, 'promptFamiliesJson', JSON.stringify(artifact.promptFamilies));
    patch.addEdge(artifact.artifactId, artifact.primaryInputId, 'derived_from');
    return;
  }

  if (artifact.kind === 'session_attribution') {
    patch
      .setProperty(artifact.artifactId, 'sessionId', artifact.sessionId)
      .setProperty(artifact.artifactId, 'reasonKind', artifact.reasonKind)
      .setProperty(artifact.artifactId, 'reasonText', artifact.reasonText);
    patch.addEdge(artifact.artifactId, artifact.primaryInputId, 'contextualizes');
  }
}

function ensureGraphMetadataNode(patch, graphMetaProps) {
  if (!graphMetaProps) {
    patch
      .addNode(GRAPH_META_ID)
      .setProperty(GRAPH_META_ID, 'kind', 'graph_meta')
      .setProperty(GRAPH_META_ID, 'createdAt', getCurrentTime().toISOString());
  }

  patch
    .setProperty(GRAPH_META_ID, 'graphModelVersion', GRAPH_MODEL_VERSION)
    .setProperty(GRAPH_META_ID, 'updatedAt', getCurrentTime().toISOString());
}

function pushMissingEdge(target, existingEdgeKeys, from, to, label) {
  const key = `${from}\0${to}\0${label}`;
  if (existingEdgeKeys.has(key)) {
    return;
  }

  existingEdgeKeys.add(key);
  target.push({ from, to, label });
}

function selectReflectPrompt(seedEntry, requestedPromptType = null) {
  const normalized = normalizeSeed(seedEntry.text);

  if (requestedPromptType === 'challenge') {
    return {
      promptType: 'challenge',
      selectionReason: {
        kind: 'requested_challenge',
        text: 'Used the requested challenge prompt family for this reflect session.',
      },
      question: pickDeterministicPrompt(CHALLENGE_PROMPTS, normalized),
    };
  }

  if (requestedPromptType === 'constraint') {
    return {
      promptType: 'constraint',
      selectionReason: {
        kind: 'requested_constraint',
        text: 'Used the requested constraint prompt family for this reflect session.',
      },
      question: pickDeterministicPrompt(CONSTRAINT_PROMPTS, normalized),
    };
  }

  if (requestedPromptType === 'sharpen') {
    return {
      promptType: 'sharpen',
      selectionReason: {
        kind: 'requested_sharpen',
        text: 'Used the requested sharpen prompt family for this reflect session.',
      },
      question: pickDeterministicPrompt(SHARPEN_PROMPTS, normalized),
    };
  }

  const familyIndex = stableHash(normalized) % 2;

  if (familyIndex === 0) {
    const question = pickDeterministicPrompt(CHALLENGE_PROMPTS, normalized);
    return {
      promptType: 'challenge',
      selectionReason: {
        kind: 'seed_only_challenge',
        text: 'Used a deterministic challenge prompt from the seed thought alone.',
      },
      question,
    };
  }

  const question = pickDeterministicPrompt(CONSTRAINT_PROMPTS, normalized);
  return {
    promptType: 'constraint',
    selectionReason: {
      kind: 'seed_only_constraint',
      text: 'Used a deterministic constraint prompt from the seed thought alone.',
    },
    question,
  };
}

async function planReflect(read, seedEntryId, { promptType = null } = {}) {
  const seedEntry = await getStoredEntry(read, seedEntryId);

  if (!seedEntry || seedEntry.kind !== 'capture') {
    return {
      ok: false,
      code: 'seed_not_found',
    };
  }

  const eligibility = assessReflectability(seedEntry.text);
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: 'seed_ineligible',
      seedEntryId,
      seedEntry,
      eligibility,
    };
  }

  return {
    ok: true,
    seedEntry,
    promptPlan: selectReflectPrompt(seedEntry, promptType),
  };
}

function pickDeterministicPrompt(prompts, normalizedSeed) {
  const index = stableHash(normalizedSeed) % prompts.length;
  return prompts[index];
}

function normalizeSeed(text) {
  return String(text).trim().toLowerCase();
}

function createThoughtId(text) {
  const fingerprint = createHash('sha256')
    .update(String(text), 'utf8')
    .digest('hex');

  return `thought:${fingerprint}`;
}

function createArtifactId(kind, primaryInputId, discriminator = '') {
  const fingerprint = createHash('sha256')
    .update([kind, primaryInputId, discriminator, DERIVER_VERSION, SCHEMA_VERSION].join('\0'), 'utf8')
    .digest('hex');

  return `${ARTIFACT_PREFIX}${fingerprint}`;
}

function deriveSeedQuality(thoughtId, text) {
  const normalized = normalizeSeed(text);
  const eligible = REFLECT_MARKERS.some((pattern) => pattern.test(normalized));

  return {
    artifactId: createArtifactId('seed_quality', thoughtId),
    kind: 'seed_quality',
    primaryInputKind: 'thought',
    primaryInputId: thoughtId,
    verdict: eligible ? 'likely_reflectable' : 'weak_note',
    reasonKind: eligible ? 'proposal_or_question_markers' : 'status_like_note',
    reasonText: eligible
      ? 'Contains explicit proposal, uncertainty, or decision language that can be pressure-tested.'
      : 'Reads more like a status, narrative, or observational note than a pressure-testable idea.',
    promptFamilies: eligible ? [...REFLECT_PROMPT_TYPES] : [],
    deriver: DERIVER_NAME,
    deriverVersion: DERIVER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: getCurrentTime().toISOString(),
  };
}

async function deriveSessionAttribution(read, entry) {
  const captures = await listEntriesByKind(read, 'capture');
  const ordered = captures
    .filter((candidate) => candidate.id !== entry.id)
    .concat([{ ...entry }])
    .sort(compareEntriesOldestFirst);

  let sessionStart = ordered[0];
  let previous = null;

  for (const capture of ordered) {
    if (previous) {
      const gapMs = Date.parse(capture.createdAt) - Date.parse(previous.createdAt);
      if (gapMs > SESSION_IDLE_GAP_MS) {
        sessionStart = capture;
      }
    }

    if (capture.id === entry.id) {
      const withinBucket = previous
        && (Date.parse(capture.createdAt) - Date.parse(previous.createdAt)) <= SESSION_IDLE_GAP_MS;
      const sessionId = `${SESSION_PREFIX}${sessionStart.sortKey}`;

      return {
        artifactId: createArtifactId('session_attribution', entry.id, sessionId),
        kind: 'session_attribution',
        primaryInputKind: 'capture',
        primaryInputId: entry.id,
        sessionId,
        sessionCreatedAt: sessionStart.createdAt,
        sessionStartSortKey: sessionStart.sortKey,
        reasonKind: withinBucket ? 'temporal_proximity' : 'new_session_bucket',
        reasonText: withinBucket
          ? 'Captured within 5 minutes of neighboring entries in the same session bucket.'
          : 'Started a new session bucket because no neighboring capture fell within the 5 minute idle-gap threshold.',
        deriver: DERIVER_NAME,
        deriverVersion: DERIVER_VERSION,
        schemaVersion: SCHEMA_VERSION,
        createdAt: getCurrentTime().toISOString(),
      };
    }

    previous = capture;
  }

  const fallbackSessionId = `${SESSION_PREFIX}${entry.sortKey}`;
  return {
    artifactId: createArtifactId('session_attribution', entry.id, fallbackSessionId),
    kind: 'session_attribution',
    primaryInputKind: 'capture',
    primaryInputId: entry.id,
    sessionId: fallbackSessionId,
    sessionCreatedAt: entry.createdAt,
    sessionStartSortKey: entry.sortKey,
    reasonKind: 'new_session_bucket',
    reasonText: 'Started a new session bucket because no neighboring capture fell within the 5 minute idle-gap threshold.',
    deriver: DERIVER_NAME,
    deriverVersion: DERIVER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: getCurrentTime().toISOString(),
  };
}

async function getCanonicalThought(read, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  const thoughtProps = await read.view.getNodeProps(thoughtId);

  return {
    entryId: entry.id,
    thoughtId,
    relation: 'expresses',
    stored: Boolean(thoughtProps),
  };
}

async function getSeedQualityReceipt(read, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  const artifactId = createArtifactId('seed_quality', thoughtId);
  const props = await read.view.getNodeProps(artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId,
    kind: 'seed_quality',
    primaryInputKind: props.primaryInputKind,
    primaryInputId: props.primaryInputId,
    verdict: props.verdict,
    reasonKind: props.reasonKind,
    reasonText: props.reasonText,
    promptFamilies: parseJsonArray(props.promptFamiliesJson),
    deriver: props.deriver,
    deriverVersion: props.deriverVersion,
    schemaVersion: props.schemaVersion,
    createdAt: props.createdAt,
  };
}

async function getSessionAttributionReceipt(read, entry) {
  const thoughtId = entry.sessionId ?? null;
  const artifactId = thoughtId
    ? createArtifactId('session_attribution', entry.id, thoughtId)
    : (await deriveSessionAttribution(read, entry)).artifactId;
  const props = await read.view.getNodeProps(artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId,
    kind: 'session_attribution',
    primaryInputKind: props.primaryInputKind,
    primaryInputId: props.primaryInputId,
    sessionId: props.sessionId,
    reasonKind: props.reasonKind,
    reasonText: props.reasonText,
    deriver: props.deriver,
    deriverVersion: props.deriverVersion,
    schemaVersion: props.schemaVersion,
    createdAt: props.createdAt,
  };
}

async function getSessionAttributionReceiptIfPresent(read, entry) {
  if (!entry.sessionId) {
    return null;
  }

  const artifactId = createArtifactId('session_attribution', entry.id, entry.sessionId);
  const props = await read.view.getNodeProps(artifactId);
  if (!props) {
    return null;
  }

  return {
    artifactId,
    kind: 'session_attribution',
    primaryInputKind: props.primaryInputKind,
    primaryInputId: props.primaryInputId,
    sessionId: props.sessionId,
    reasonKind: props.reasonKind,
    reasonText: props.reasonText,
    deriver: props.deriver,
    deriverVersion: props.deriverVersion,
    schemaVersion: props.schemaVersion,
    createdAt: props.createdAt,
  };
}

async function getLatestCaptureId(read) {
  const result = await read.view.query()
    .match(GRAPH_META_ID)
    .outgoing('latest_capture')
    .run();
  return result.nodes?.[0]?.id ?? null;
}

async function getProducedInSessionId(read, entry) {
  const result = await read.view.query()
    .match(entry.id)
    .outgoing('produced_in')
    .run();
  return result.nodes?.[0]?.id ?? entry.sessionId ?? null;
}

async function hasNode(read, nodeId) {
  return read.view.hasNode(nodeId);
}

async function resolveGraphSessionTraversal(read, entry) {
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

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stableHash(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function buildAmbientRememberScope(cwd) {
  const context = getAmbientProjectContext(cwd);

  return {
    scopeKind: 'ambient_project',
    cwd: context.cwd,
    gitRoot: context.gitRoot,
    gitRemote: context.gitRemote,
    gitBranch: context.gitBranch,
    projectName: context.projectName,
    projectTokens: context.projectTokens,
  };
}

function buildExplicitRememberScope(query) {
  return {
    scopeKind: 'query',
    queryText: String(query).trim(),
    queryTerms: buildQueryTerms(query),
  };
}

function buildAmbientRememberMatch(entry, scope) {
  const matchKinds = [];
  let tier = 0;
  let score = 0;
  let reasonText = '';
  let hasProjectScopedAmbientMatch = false;

  if (scope.gitRemote && entry.ambientGitRemote === scope.gitRemote) {
    matchKinds.push('ambient_git_remote');
    tier = 3;
    score += 100;
    reasonText = 'matched current git remote';
    hasProjectScopedAmbientMatch = true;
  }

  if (scope.gitRoot && entry.ambientGitRoot === scope.gitRoot) {
    matchKinds.push('ambient_git_root');
    tier = Math.max(tier, 3);
    score += 80;
    if (!reasonText) {
      reasonText = 'matched current git root';
    }
    hasProjectScopedAmbientMatch = true;
  }

  if (scope.cwd && entry.ambientCwd === scope.cwd) {
    matchKinds.push('ambient_cwd');
    tier = Math.max(tier, 3);
    score += 60;
    if (!reasonText) {
      reasonText = 'matched current working directory';
    }
    hasProjectScopedAmbientMatch = true;
  }

  if (
    hasProjectScopedAmbientMatch
    && scope.gitBranch
    && entry.ambientGitBranch
    && entry.ambientGitBranch === scope.gitBranch
  ) {
    matchKinds.push('ambient_git_branch');
    tier = Math.max(tier, 3);
    score += 10;
    if (!reasonText) {
      reasonText = 'matched current git branch';
    }
  }

  const fallbackToken = findFirstMatchingTerm(entry.text, scope.projectTokens);
  if (fallbackToken) {
    matchKinds.push(tier > 0 ? 'project_tokens_text' : 'fallback_text');
    tier = Math.max(tier, tier > 0 ? 3 : 2);
    score += tier > 2 ? 15 : 30;
    if (!reasonText) {
      reasonText = `fallback textual match on project token "${fallbackToken}"`;
    }
  }

  if (tier === 0) {
    return null;
  }

  return {
    entryId: entry.id,
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    score,
    tier,
    matchKinds,
    reasonText,
  };
}

function buildExplicitRememberMatch(entry, scope) {
  const normalizedText = normalizeSeed(entry.text);
  const normalizedQuery = normalizeSeed(scope.queryText);
  const matchedTerms = scope.queryTerms.filter((term) => normalizedText.includes(term));

  if (!normalizedText.includes(normalizedQuery) && matchedTerms.length === 0) {
    return null;
  }

  const matchKinds = normalizedText.includes(normalizedQuery)
    ? ['query_phrase']
    : ['query_terms'];
  const reasonText = normalizedText.includes(normalizedQuery)
    ? `matched query phrase "${scope.queryText}"`
    : `matched query terms "${matchedTerms.join('", "')}"`;

  return {
    entryId: entry.id,
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    score: matchedTerms.length || 1,
    tier: 1,
    matchKinds,
    reasonText,
  };
}

function compareRememberMatches(left, right) {
  if (left.tier !== right.tier) {
    return right.tier - left.tier;
  }

  if (left.sortKey === right.sortKey) {
    return right.entryId.localeCompare(left.entryId);
  }

  return right.sortKey.localeCompare(left.sortKey);
}

function finalizeRememberMatches(matches, { brief, limit }) {
  const bounded = Number.isInteger(limit) ? matches.slice(0, limit) : matches;
  if (!brief) {
    return bounded;
  }

  return bounded.map((match) => ({
    ...match,
    text: toRememberBriefText(match.text),
  }));
}

function toRememberBriefText(text) {
  const [firstLine = ''] = String(text).split('\n');
  return firstLine.trim();
}

function findFirstMatchingTerm(text, terms) {
  const normalized = normalizeSeed(text);
  return terms.find((term) => normalized.includes(term)) ?? null;
}

function compareEntriesNewestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return right.id.localeCompare(left.id);
  }

  return right.sortKey.localeCompare(left.sortKey);
}

function compareEntriesOldestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return left.id.localeCompare(right.id);
  }

  return left.sortKey.localeCompare(right.sortKey);
}

function resolveSessionTraversal(entries, currentEntry) {
  if (!currentEntry?.sessionId) {
    return {
      sessionPosition: null,
      sessionCount: 0,
      previous: null,
      next: null,
    };
  }

  const sessionEntries = entries
    .filter((entry) => entry.sessionId === currentEntry.sessionId)
    .sort(compareEntriesOldestFirst);
  const currentIndex = sessionEntries.findIndex((entry) => entry.id === currentEntry.id);

  if (currentIndex === -1) {
    return {
      sessionPosition: null,
      sessionCount: sessionEntries.length,
      previous: null,
      next: null,
    };
  }

  return {
    sessionPosition: currentIndex + 1,
    sessionCount: sessionEntries.length,
    previous: currentIndex > 0 ? sessionEntries[currentIndex - 1] : null,
    next: currentIndex + 1 < sessionEntries.length ? sessionEntries[currentIndex + 1] : null,
  };
}

function matchesRecentQuery(text, query) {
  return String(text).toLowerCase().includes(String(query).trim().toLowerCase());
}

function getCurrentTime() {
  if (process.env.THINK_TEST_NOW) {
    const ms = parseInt(process.env.THINK_TEST_NOW, 10);
    if (!isNaN(ms)) {
      return new Date(ms);
    }
  }
  return new Date();
}

function parseSince(since, now) {
  const match = since.match(/^(\d+)([hdw])$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const ms = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }[unit];

  return new Date(now.getTime() - value * ms);
}

function formatBucketKey(date, bucket) {
  const iso = date.toISOString();
  if (bucket === 'hour') return iso.substring(0, 13) + ':00';
  if (bucket === 'day') return iso.substring(0, 10);
  if (bucket === 'week') {
    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - day.getUTCDay());
    return day.toISOString().substring(0, 10);
  }
  return iso.substring(0, 10);
}

function createWriterId() {
  const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const safeHostname = hostname || 'unknown-host';
  return `local.${safeHostname}.cli`;
}
