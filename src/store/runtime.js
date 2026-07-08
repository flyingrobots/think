import { GitGraphAdapter, openWarpWorldline } from '@git-stunts/git-warp';

import { ContentUnavailableError } from '../errors.js';
import { resolveHistorySessionEntries } from '../history/session.js';
import { createThinkPlumbing } from '../git.js';
import {
  ARTIFACT_PREFIX,
  ENTRY_PREFIX,
  EXACT_READ_UNAVAILABLE,
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
  createWriterId,
  storesTextContent,
} from './model.js';
import {
  captureRecordToProps,
  readCaptureReadModel,
  readCaptureRecords,
} from './read-model.js';

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
const warpWorldlineCache = new Map();
const runtimeBlobStorageCache = new Map();
const opticBasisCache = new WeakMap();

export async function openThinkWorldline(repoDir) {
  const cached = warpWorldlineCache.get(repoDir);
  if (cached) {
    return cached;
  }

  const worldline = await openThinkWorldlineOnce(repoDir, createWriterId());
  warpWorldlineCache.set(repoDir, worldline);
  return worldline;
}

async function openThinkWorldlineOnce(repoDir, writerId) {
  const persistence = createThinkWarpPersistence(repoDir);

  return await openWarpWorldline({
    persistence,
    worldlineName: GRAPH_NAME,
    writerId,
  });
}

function createThinkWarpPersistence(repoDir) {
  return new GitGraphAdapter({
    plumbing: createThinkPlumbing(repoDir),
  });
}

export function clearWarpRuntimeCache(repoDir) {
  warpWorldlineCache.delete(repoDir);
  runtimeBlobStorageCache.delete(repoDir);
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

      clearWarpRuntimeCache(repoDir);
      attempt += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
}

export async function commitThinkWorldlineWithWriter(repoDir, writerId, patcher, {
  maxAttempts = DEFAULT_PATCH_MAX_ATTEMPTS,
} = {}) {
  let attempt = 1;

  /* eslint-disable no-await-in-loop -- retry attempts must run sequentially against a refreshed worldline */
  while (true) {
    const worldline = await openThinkWorldlineOnce(repoDir, writerId);

    try {
      await worldline.commit(patcher);
      return worldline;
    } catch (error) {
      if (!isWriterCasConflict(error) || attempt >= maxAttempts) {
        throw error;
      }

      attempt += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
}

export function isWriterCasConflict(error) {
  return error instanceof Error && error.message.includes(WRITER_CAS_CONFLICT_TEXT);
}

export async function openProductReadHandle(repoDir) {
  return await createWorldlineProductReadHandle({ repoDir });
}

async function createWorldlineProductReadHandle({
  repoDir,
}) {
  const worldline = await openThinkWorldline(repoDir);
  const blobStorage = await getRuntimeBlobStorage(repoDir);

  return {
    app: null,
    repoDir,
    worldline,
    view: worldline.live(),
    contentCore: null,
    blobStorage,
    readContent: readUnavailableRuntimeContent,
    readContentRequiresContentOid: true,
    readNodeProp: createWorldlineExactPropReader(worldline),
    writerId: worldline.writerId,
  };
}

function readUnavailableRuntimeContent(nodeId) {
  throw new ContentUnavailableError(
    `Content for ${nodeId} is unavailable: this git-warp runtime exposes no public content reader fallback.`,
  );
}

function createWorldlineExactPropReader(worldline) {
  return async (nodeId, key) => {
    if (opticBasisCache.get(worldline) === false) {
      return EXACT_READ_UNAVAILABLE;
    }

    try {
      await prepareCachedOpticBasis(worldline);

      const result = await worldline.optic().node(nodeId).prop(key).read();
      return result.exists ? result.value : undefined;
    } catch (error) {
      if (isMissingBoundedOpticBasis(error)) {
        return EXACT_READ_UNAVAILABLE;
      }
      throw error;
    }
  };
}

async function prepareCachedOpticBasis(worldline) {
  const cached = opticBasisCache.get(worldline);
  if (cached) {
    return cached;
  }

  const basisPromise = worldline.prepareOpticBasis();
  opticBasisCache.set(worldline, basisPromise);

  try {
    await basisPromise;
    return basisPromise;
  } catch (error) {
    if (isMissingBoundedOpticBasis(error)) {
      opticBasisCache.set(worldline, false);
    } else {
      opticBasisCache.delete(worldline);
    }
    throw error;
  }
}

function isMissingBoundedOpticBasis(error) {
  return error instanceof Error && (
    error.code === 'E_OPTIC_NO_BOUNDED_BASIS' ||
    error.message.includes('E_OPTIC_NO_BOUNDED_BASIS')
  );
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
  const captures = await listRecentStoredEntries(read, {
    kind: 'capture',
    limit: Number.MAX_SAFE_INTEGER,
  });
  return captures
    .map(toBrowseEntry)
    .sort(compareEntriesNewestFirst);
}

export async function getSingleNeighborId(read, nodeId, direction, label) {
  const query = read.view.query().match(nodeId);
  const result = direction === 'incoming'
    ? await query.incoming(label).run()
    : await query.outgoing(label).run();
  return result.nodes?.[0]?.id ?? null;
}

export async function getLatestStoredEntry(read, kind = 'capture', options = {}) {
  const latestId = await getLatestIdByKind(read, kind, options);
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

  for (const entry of await listRecentCandidateEntries(read, { kind, limit: maxEntries })) {
    yield entry;
  }
}

async function getLatestIdByKind(read, kind, options = {}) {
  if (kind !== 'capture') {
    return null;
  }

  return await getLatestCaptureId(read, options);
}

export async function readNodeText(read, nodeId, props = null) {
  const contentOid = await resolveNodeContentOid(read, nodeId, props);
  const content = await readNodeContent(read, nodeId, contentOid);
  if (hasReadableContent(content)) {
    return decodeContent(content);
  }

  if (contentOid) {
    throw new ContentUnavailableError(
      `Content for ${nodeId} is unavailable: the read handle has a content oid but no readable content source.`,
    );
  }

  return '';
}

async function resolveNodeContentOid(read, nodeId, props) {
  const resolvedProps = props ?? await read.view.getNodeProps(nodeId);
  if (typeof resolvedProps?._content === 'string') {
    return resolvedProps._content;
  }
  return await readNodeContentOid(read, nodeId);
}

async function readNodeContent(read, nodeId, contentOid) {
  const attachedContent = await readAttachedContent(read, contentOid);
  if (hasReadableContent(attachedContent)) {
    return attachedContent;
  }
  if (!contentOid && read.readContentRequiresContentOid) {
    return null;
  }
  return await readContent(read, nodeId);
}

async function readAttachedContent(read, contentOid) {
  if (contentOid && read.blobStorage) {
    return await read.blobStorage.retrieve(contentOid);
  }
  return null;
}

function decodeContent(content) {
  return new TextDecoder().decode(content);
}

function hasReadableContent(content) {
  return content !== null && content !== undefined;
}

async function readContent(read, nodeId) {
  if (typeof read.readContent === 'function') {
    return await read.readContent(nodeId);
  }
  return await read.contentCore?.getContent?.(nodeId) ?? null;
}

async function readNodeContentOid(read, nodeId) {
  if (typeof read.view.getNodeContentMeta !== 'function') {
    return null;
  }
  const contentMeta = await read.view.getNodeContentMeta(nodeId);
  return typeof contentMeta?.oid === 'string' ? contentMeta.oid : null;
}

export async function getLatestCaptureId(read, { excludeIds = [] } = {}) {
  const index = await readCaptureReadModel(read);
  const excludedIds = new Set(excludeIds);
  return index.refs.find((ref) => !excludedIds.has(ref.id))?.id ?? null;
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

export async function resolveHistorySessionTraversal(read, entry) {
  if (!entry) {
    return emptySessionTraversal();
  }

  const sessionEntries = await listHistorySessionBrowseEntries(read, entry);
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

export const resolveGraphSessionTraversal = resolveHistorySessionTraversal;

async function listHistorySessionBrowseEntries(read, entry) {
  if (!entry.sessionId) {
    return [];
  }

  const captureProps = await listIndexedCaptureProps(read, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const sessionEntryProps = resolveHistorySessionEntries(captureProps, entry);
  const sessionEntries = [];

  for (const props of sessionEntryProps) {
    // eslint-disable-next-line no-await-in-loop -- bounded hydration of entries in the visible session
    const sessionEntry = await readHistorySessionBrowseEntry(read, entry, props);
    if (sessionEntry) {
      sessionEntries.push(sessionEntry);
    }
  }

  return sessionEntries;
}

async function readHistorySessionBrowseEntry(read, currentEntry, props) {
  if (props.id === currentEntry.id) {
    return toBrowseEntry(currentEntry);
  }

  const capture = await getStoredEntry(read, props.id, props);
  return capture?.kind === 'capture' ? toBrowseEntry(capture) : null;
}

function emptySessionTraversal() {
  return {
    entries: [],
    sessionCount: 0,
    sessionPosition: null,
    previous: null,
    next: null,
  };
}

export async function listIndexedCaptureProps(read, { limit = 50 } = {}) {
  const records = await readCaptureRecords(read, { limit });
  if (records.length > 0) {
    return records
      .map((record) => Object.freeze({
        id: record.id,
        ...captureRecordToProps(record),
      }))
      .sort(compareEntriesNewestFirst);
  }
  if (typeof read.readNodeProp === 'function') {
    return [];
  }

  const index = await readCaptureReadModel(read);
  const maxEntries = Number.isInteger(limit) ? Math.max(0, limit) : 50;
  const props = [];

  for (const ref of index.refs.slice(0, maxEntries)) {
    // eslint-disable-next-line no-await-in-loop -- exact bounded read per indexed capture
    const captureProps = await read.view.getNodeProps(ref.id);
    if (captureProps?.kind === 'capture') {
      props.push(Object.freeze({
        id: ref.id,
        ...captureProps,
      }));
    }
  }

  return props.sort(compareEntriesNewestFirst);
}

export async function listStoredEntriesByRefs(read, refs, { limit = 50, kind = 'capture' } = {}) {
  const maxEntries = Number.isInteger(limit) ? Math.max(0, limit) : 50;
  const entries = await hydrateStoredEntriesByRefs(read, refs.slice(0, maxEntries), kind);
  return entries.sort(compareEntriesNewestFirst);
}

async function listRecentCandidateEntries(read, { kind, limit }) {
  if (kind === 'capture') {
    const recordEntries = await listRecentCaptureRecordEntries(read, { limit });
    if (recordEntries.length > 0) {
      return recordEntries;
    }
    if (typeof read.readNodeProp === 'function') {
      return [];
    }
  }

  const candidates = await listRecentCandidateProps(read, { kind, limit });
  const entries = [];

  for (const candidate of candidates.sort(compareEntriesNewestFirst).slice(0, limit)) {
    // eslint-disable-next-line no-await-in-loop -- exact bounded read per indexed capture
    const entry = await getStoredEntry(read, candidate.id, candidate);
    if (entry && entry.kind === kind) {
      entries.push(entry);
    }
  }

  return entries;
}

async function listRecentCaptureRecordEntries(read, { limit }) {
  const records = await readCaptureRecords(read, { limit });
  return records
    .map(captureRecordToEntry)
    .sort(compareEntriesNewestFirst);
}

function captureRecordToEntry(record) {
  return new CaptureEntry(record.id, captureRecordToProps(record), record.text);
}

async function listRecentCandidateProps(read, { kind, limit }) {
  if (kind === 'capture') {
    return await listIndexedCaptureProps(read, { limit });
  }

  return await listEntryPropsByKind(read, kind);
}

async function hydrateStoredEntriesByRefs(read, refs, kind) {
  const entries = [];

  for (const ref of refs) {
    // eslint-disable-next-line no-await-in-loop -- exact bounded read per indexed capture
    const entry = await getStoredEntry(read, ref.id);
    if (isRequestedEntryKind(entry, kind)) {
      entries.push(entry);
    }
  }

  return entries;
}

function isRequestedEntryKind(entry, kind) {
  return Boolean(entry) && (!kind || entry.kind === kind);
}

export async function getChronologyNeighborEntries(read, currentEntry) {
  const indexedNeighbors = await getIndexedChronologyNeighborEntries(read, currentEntry);
  if (indexedNeighbors.found) {
    return Object.freeze({
      newer: indexedNeighbors.newer,
      older: indexedNeighbors.older,
    });
  }

  return Object.freeze({
    newer: await hydrateChronologyNeighborByEdge(read, currentEntry.id, 'newer'),
    older: await hydrateChronologyNeighborByEdge(read, currentEntry.id, 'older'),
  });
}

async function getIndexedChronologyNeighborEntries(read, currentEntry) {
  const index = await readCaptureReadModel(read);
  const currentIndex = index.refs.findIndex((ref) => ref.id === currentEntry.id);
  if (currentIndex < 0) {
    return Object.freeze({ found: false, newer: null, older: null });
  }

  return Object.freeze({
    found: true,
    newer: await hydrateChronologyNeighbor(read, index.refs[currentIndex - 1] ?? null),
    older: await hydrateChronologyNeighbor(read, index.refs[currentIndex + 1] ?? null),
  });
}

async function hydrateChronologyNeighbor(read, ref) {
  return ref ? await getStoredEntry(read, ref.id) : null;
}

async function hydrateChronologyNeighborByEdge(read, entryId, label) {
  const result = await read.view.query()
    .match(entryId)
    .outgoing(label)
    .run();
  const neighborId = result.nodes?.[0]?.id ?? null;
  return neighborId ? await getStoredEntry(read, neighborId) : null;
}
