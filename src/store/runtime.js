import WarpApp, { GitGraphAdapter, openWarpGraph, openWarpWorldline } from '@git-stunts/git-warp';

import { createThinkPlumbing } from '../git.js';
import { createAppContentReader } from './content-reader.js';
import { openCheckpointProductRead } from './checkpoint-product-read.js';
import { deleteCheckpointRef, isUnsupportedCheckpointSchemaError } from './checkpoint-state.js';
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
  SESSION_KINDS,
  SESSION_PREFIX,
  THOUGHT_PREFIX,
} from './constants.js';
import {
  compareEntriesNewestFirst,
  compareEntriesOldestFirst,
  createWriterId,
  storesTextContent,
} from './model.js';

export class GenericEntry {
  constructor(nodeId, resolvedProps, text) {
    this.id = nodeId;
    this.kind = resolvedProps.kind;
    this.writerId = resolvedProps.writerId;
    this.createdAt = resolvedProps.createdAt;
    this.sortKey = String(resolvedProps.sortKey || '');
    this.text = text;
    Object.freeze(this);
  }
}

export class CaptureEntry {
  constructor(nodeId, resolvedProps, text) {
    this.id = nodeId;
    this.kind = resolvedProps.kind;
    this.writerId = resolvedProps.writerId;
    this.createdAt = resolvedProps.createdAt;
    this.sortKey = String(resolvedProps.sortKey || '');
    this.text = text;
    this.source = resolvedProps.source;
    this.channel = resolvedProps.channel;
    this.thoughtId = resolvedProps.thoughtId ?? null;
    this.sessionId = resolvedProps.sessionId ?? null;
    this.ambientCwd = resolvedProps.ambientCwd ?? null;
    this.ambientGitRoot = resolvedProps.ambientGitRoot ?? null;
    this.ambientGitRemote = resolvedProps.ambientGitRemote ?? null;
    this.ambientGitBranch = resolvedProps.ambientGitBranch ?? null;
    this.captureProvenance = resolvedProps.captureIngress || resolvedProps.captureSourceApp || resolvedProps.captureSourceURL
      ? Object.freeze({
          ingress: resolvedProps.captureIngress ?? null,
          sourceApp: resolvedProps.captureSourceApp ?? null,
          sourceURL: resolvedProps.captureSourceURL ?? null,
        })
      : null;
    Object.freeze(this);
  }
}

export class ReflectEntry {
  constructor(nodeId, resolvedProps, text) {
    this.id = nodeId;
    this.kind = resolvedProps.kind;
    this.writerId = resolvedProps.writerId;
    this.createdAt = resolvedProps.createdAt;
    this.sortKey = String(resolvedProps.sortKey || '');
    this.text = text;
    this.seedEntryId = resolvedProps.seedEntryId ?? null;
    this.contrastEntryId = resolvedProps.contrastEntryId ?? null;
    this.promptType = resolvedProps.promptType ?? null;
    this.question = resolvedProps.question ?? null;
    this.selectionReason = resolvedProps.selectionReasonKind
      ? Object.freeze({
          kind: resolvedProps.selectionReasonKind,
          text: resolvedProps.selectionReasonText ?? '',
        })
      : null;
    this.stepCount = Number(resolvedProps.stepCount ?? 0);
    this.maxSteps = Number(resolvedProps.maxSteps ?? 0);
    Object.freeze(this);
  }
}

export class AnnotationEntry {
  constructor(nodeId, resolvedProps, text) {
    this.id = nodeId;
    this.kind = resolvedProps.kind;
    this.writerId = resolvedProps.writerId;
    this.createdAt = resolvedProps.createdAt;
    this.sortKey = String(resolvedProps.sortKey || '');
    this.text = text;
    Object.freeze(this);
  }
}

export class BaseEntry {
  static from(nodeId, resolvedProps, text) {
    if (resolvedProps.kind === 'capture') { return new CaptureEntry(nodeId, resolvedProps, text); }
    if (resolvedProps.kind === 'reflect' || SESSION_KINDS.includes(resolvedProps.kind)) {
      return new ReflectEntry(nodeId, resolvedProps, text);
    }
    if (resolvedProps.kind === 'annotation') { return new AnnotationEntry(nodeId, resolvedProps, text); }
    return new GenericEntry(nodeId, resolvedProps, text);
  }
}

const WRITER_CAS_CONFLICT_TEXT = 'writer ref was updated by another process';
const DEFAULT_PATCH_MAX_ATTEMPTS = 3;
const warpAppCache = new Map();
const warpWorldlineCache = new Map();
const runtimeBlobStorageCache = new Map();

export async function openWarpApp(repoDir) {
  const cached = warpAppCache.get(repoDir);
  if (cached) {
    return cached;
  }

  const app = await openWarpAppWithCheckpointRepair(repoDir, createWriterId());
  warpAppCache.set(repoDir, app);
  return app;
}

export async function openWarpGraphHandle(repoDir, writerId = createWriterId()) {
  return await openWarpGraphWithCheckpointRepair(repoDir, writerId);
}

export async function openThinkWorldline(repoDir) {
  const cached = warpWorldlineCache.get(repoDir);
  if (cached) {
    return cached;
  }

  const worldline = await openThinkWorldlineWithCheckpointRepair(repoDir, createWriterId());
  warpWorldlineCache.set(repoDir, worldline);
  return worldline;
}

async function openWarpAppWithCheckpointRepair(repoDir, writerId) {
  try {
    return await openWarpAppOnce(repoDir, writerId);
  } catch (error) {
    if (!isUnsupportedCheckpointSchemaError(error)) {
      throw error;
    }

    await deleteCheckpointRef(repoDir);
    return await openWarpAppOnce(repoDir, writerId);
  }
}

async function openWarpGraphWithCheckpointRepair(repoDir, writerId) {
  try {
    return await openWarpGraphOnce(repoDir, writerId);
  } catch (error) {
    if (!isUnsupportedCheckpointSchemaError(error)) {
      throw error;
    }

    await deleteCheckpointRef(repoDir);
    return await openWarpGraphOnce(repoDir, writerId);
  }
}

async function openThinkWorldlineWithCheckpointRepair(repoDir, writerId) {
  try {
    return await openThinkWorldlineOnce(repoDir, writerId);
  } catch (error) {
    if (!isUnsupportedCheckpointSchemaError(error)) {
      throw error;
    }

    await deleteCheckpointRef(repoDir);
    return await openThinkWorldlineOnce(repoDir, writerId);
  }
}

async function openWarpAppOnce(repoDir, writerId) {
  const persistence = createThinkWarpPersistence(repoDir);

  return await WarpApp.open({
    persistence,
    graphName: GRAPH_NAME,
    writerId,
    checkpointPolicy: CHECKPOINT_POLICY,
  });
}

async function openWarpGraphOnce(repoDir, writerId) {
  const persistence = createThinkWarpPersistence(repoDir);

  return await openWarpGraph({
    persistence,
    graphName: GRAPH_NAME,
    writerId,
    checkpointPolicy: CHECKPOINT_POLICY,
  });
}

async function openThinkWorldlineOnce(repoDir, writerId) {
  const persistence = createThinkWarpPersistence(repoDir);

  return await openWarpWorldline({
    persistence,
    worldlineName: GRAPH_NAME,
    writerId,
    checkpointPolicy: CHECKPOINT_POLICY,
  });
}

function createThinkWarpPersistence(repoDir) {
  return new GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });
}

export function clearWarpAppCache(repoDir) {
  warpAppCache.delete(repoDir);
  warpWorldlineCache.delete(repoDir);
}

export async function patchWarpApp(repoDir, patcher, {
  genesisOnNoState = false,
  maxAttempts = DEFAULT_PATCH_MAX_ATTEMPTS,
  syncAfterPatch = true,
} = {}) {
  let attempt = 1;

  /* eslint-disable no-await-in-loop -- retry attempts must run sequentially against a refreshed cached app */
  while (true) {
    const app = await openWarpApp(repoDir);

    try {
      try {
        await app.patch(patcher);
      } catch (error) {
        if (!genesisOnNoState || error?.code !== 'E_NO_STATE') {
          throw error;
        }
        await app.patch(patcher, { genesis: true });
      }

      if (syncAfterPatch) {
        await app.syncWith(app.core());
      }

      return app;
    } catch (error) {
      if (!isWriterCasConflict(error) || attempt >= maxAttempts) {
        throw error;
      }

      clearWarpAppCache(repoDir);
      attempt += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
}

export async function commitThinkWorldline(repoDir, patcher, {
  maxAttempts = DEFAULT_PATCH_MAX_ATTEMPTS,
} = {}) {
  let attempt = 1;

  /* eslint-disable no-await-in-loop -- retry attempts must run sequentially against a refreshed worldline */
  while (true) {
    const worldline = await openThinkWorldline(repoDir);

    try {
      await worldline.commit(patcher);
      return worldline;
    } catch (error) {
      if (!isWriterCasConflict(error) || attempt >= maxAttempts) {
        throw error;
      }

      clearWarpAppCache(repoDir);
      attempt += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
}

export async function patchWarpAppWithWriter(repoDir, writerId, patcher, {
  genesisOnNoState = false,
  maxAttempts = DEFAULT_PATCH_MAX_ATTEMPTS,
  syncAfterPatch = true,
} = {}) {
  let attempt = 1;

  /* eslint-disable no-await-in-loop -- retry attempts must run sequentially against a refreshed app */
  while (true) {
    const app = await openWarpAppUncached(repoDir, writerId);

    try {
      try {
        await app.patch(patcher);
      } catch (error) {
        if (!genesisOnNoState || error?.code !== 'E_NO_STATE') {
          throw error;
        }
        await app.patch(patcher, { genesis: true });
      }

      if (syncAfterPatch) {
        await app.syncWith(app.core());
      }

      return app;
    } catch (error) {
      if (!isWriterCasConflict(error) || attempt >= maxAttempts) {
        throw error;
      }

      attempt += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
}

async function openWarpAppUncached(repoDir, writerId) {
  return await openWarpAppWithCheckpointRepair(repoDir, writerId);
}

export function isWriterCasConflict(error) {
  return error instanceof Error && error.message.includes(WRITER_CAS_CONFLICT_TEXT);
}

export async function createProductReadHandle(app, repoDir = null) {
  const worldline = app.worldline();
  const view = await worldline.observer('think-product', PRODUCT_READ_LENS);

  return {
    app,
    repoDir,
    worldline,
    view,
    contentCore: app.core(),
    blobStorage: repoDir ? await getRuntimeBlobStorage(repoDir) : null,
    readContent: createAppContentReader(app),
    writerId: app.writerId,
  };
}

export async function openProductReadHandle(repoDir) {
  const app = await openWarpApp(repoDir);
  const checkpointRead = await tryOpenCheckpointProductRead(repoDir, app);
  const worldline = app.worldline();
  const view = checkpointRead?.view ?? await worldline.observer('think-product', PRODUCT_READ_LENS);

  return {
    app,
    repoDir,
    worldline,
    view,
    contentCore: app.core(),
    blobStorage: checkpointRead?.blobStorage ?? await getRuntimeBlobStorage(repoDir),
    readContent: checkpointRead?.readContent ?? createAppContentReader(app),
    writerId: app.writerId,
  };
}

async function tryOpenCheckpointProductRead(repoDir, app = null) {
  try {
    return await openCheckpointProductRead(repoDir, app);
  } catch {
    return null;
  }
}

async function getRuntimeBlobStorage(repoDir) {
  if (runtimeBlobStorageCache.has(repoDir)) {
    return await runtimeBlobStorageCache.get(repoDir);
  }

  const plumbing = createThinkPlumbing(repoDir);
  const persistence = new GitGraphAdapter({ plumbing });
  const blobStorage = createRuntimeBlobStorage(persistence);
  runtimeBlobStorageCache.set(repoDir, blobStorage);
  return await blobStorage;
}

function createRuntimeBlobStorage(persistence) {
  const createStorage = persistence.createRuntimeBlobStorage;
  if (typeof createStorage !== 'function') {
    return null;
  }
  return createStorage.call(persistence);
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

  const text = storesTextContent(resolvedProps.kind)
    ? await readNodeText(read, nodeId, resolvedProps)
    : '';

  return BaseEntry.from(nodeId, resolvedProps, text);
}

export function toBrowseEntry(entry) {
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
  if (!session || !SESSION_KINDS.includes(session.kind)) {
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
    // eslint-disable-next-line no-await-in-loop -- sequential graph reads per query result node
    const entry = await getStoredEntry(read, node.id, node.props ?? null);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

export async function listEntryPropsByKind(read, kind) {
  const result = await read.view.query()
    .match(getMatchPatternsForKind(kind))
    .where({ kind })
    .run();

  return (result.nodes ?? []).map((node) => Object.freeze({
    id: node.id,
    ...(node.props ?? {}),
  }));
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
    // eslint-disable-next-line no-await-in-loop -- sequential graph traversal following 'older' edges
    const entry = await getStoredEntry(read, currentId);
    if (!entry || entry.kind !== 'capture') {
      continue;
    }

    entries.push(toBrowseEntry(entry));
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

export async function getLatestStoredEntry(read, kind = 'capture') {
  const latestId = await getLatestIdByKind(read, kind);
  return latestId ? await getStoredEntry(read, latestId) : null;
}

export async function listRecentStoredEntries(read, { kind = 'capture', limit = 50 } = {}) {
  const entries = [];
  for await (const entry of iterateRecentStoredEntries(read, { kind, limit })) {
    entries.push(entry);
  }
  return entries;
}

export async function* iterateRecentStoredEntries(read, { kind = 'capture', limit = 50 } = {}) {
  const maxEntries = Number.isInteger(limit) ? Math.max(0, limit) : 50;
  if (maxEntries === 0) {
    return;
  }

  const candidates = await listEntryPropsByKind(read, kind);
  for (const candidate of candidates.sort(compareEntriesNewestFirst).slice(0, maxEntries)) {
    // eslint-disable-next-line no-await-in-loop -- bounded retrieval of selected recent entries
    const entry = await getStoredEntry(read, candidate.id, candidate);
    if (entry && entry.kind === kind) {
      yield entry;
    }
  }
}

async function getLatestIdByKind(read, kind) {
  if (kind !== 'capture') {
    // For now, only capture has a latest pointer.
    // Future: generic latest_by_kind metadata.
    return null;
  }

  return await getLatestCaptureId(read);
}

export async function readNodeText(read, nodeId, props = null) {
  const resolvedProps = props ?? await read.view.getNodeProps(nodeId);
  const contentOid = typeof resolvedProps?._content === 'string'
    ? resolvedProps._content
    : await readNodeContentOid(read, nodeId);
  const content = contentOid && read.blobStorage
    ? await read.blobStorage.retrieve(contentOid)
    : await readContent(read, nodeId);
  return content ? new TextDecoder().decode(content) : '';
}

async function readContent(read, nodeId) {
  if (typeof read.readContent === 'function') {
    return await read.readContent(nodeId);
  }
  return await read.contentCore.getContent(nodeId);
}

async function readNodeContentOid(read, nodeId) {
  if (typeof read.view.getNodeContentMeta !== 'function') {
    return null;
  }
  const contentMeta = await read.view.getNodeContentMeta(nodeId);
  return typeof contentMeta?.oid === 'string' ? contentMeta.oid : null;
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

// eslint-disable-next-line require-await -- wraps git-warp view.hasNode which returns a promise
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
    // eslint-disable-next-line no-await-in-loop -- sequential graph reads for session neighbor traversal
    const capture = await getStoredEntry(read, neighbor.id, neighbor.props ?? null);
    if (!capture || capture.kind !== 'capture') {
      continue;
    }
    sessionEntries.push(toBrowseEntry(capture));
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
