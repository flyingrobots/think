import { resolveHistorySessionEntries } from '../history/session.js';
import {
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
  SESSION_KINDS,
} from './constants.js';
import { compareEntriesNewestFirst } from './model.js';
import {
  listIndexedMemoryDocuments,
  readIndexedMemoryDocument,
  readNativeIndexSummary,
} from './native-index.js';
import {
  decodeNativeDocument,
} from './native-document.js';
import {
  closeNativeMemory,
  openNativeMemory,
} from './native-runtime.js';

const COMMON_ENTRY_FACTS = Object.freeze([
  'kind',
  'text',
  'writerId',
  'createdAt',
  'sortKey',
  'source',
  'channel',
]);
const CAPTURE_FACTS = Object.freeze([
  'thoughtId',
  'sessionId',
  'ambientCwd',
  'ambientGitRoot',
  'ambientGitRemote',
  'ambientGitBranch',
  'captureIngress',
  'captureSourceApp',
  'captureSourceURL',
]);
const REFLECT_FACTS = Object.freeze([
  'seedEntryId',
  'contrastEntryId',
  'sessionId',
  'promptType',
  'question',
  'selectionReasonKind',
  'selectionReasonText',
  'stepCount',
  'maxSteps',
]);
const ANNOTATION_FACTS = Object.freeze([
  'targetEntryId',
]);
const DOMAIN_FACTS = Object.freeze([
  'name',
  'normalizedName',
  'thoughtCount',
  'primaryInputKind',
  'primaryInputId',
  'verdict',
  'reasonKind',
  'reasonText',
  'deriver',
  'deriverVersion',
  'schemaVersion',
  'updatedAt',
]);
const ENTRY_FACTS = Object.freeze([
  ...COMMON_ENTRY_FACTS,
  ...CAPTURE_FACTS,
  ...REFLECT_FACTS,
  ...ANNOTATION_FACTS,
  ...DOMAIN_FACTS,
]);
const NO_INDEXED_KINDS = Object.freeze([]);
const INDEXED_KINDS_BY_PREFIX = Object.freeze([
  ['entry:', Object.freeze(['capture', 'reflect'])],
  ['session:', Object.freeze(['session'])],
  ['reflect:', Object.freeze(['reflect_session'])],
  ['brainstorm:', Object.freeze(['brainstorm_session'])],
  ['annotation:', Object.freeze(['annotation'])],
  ['artifact:', Object.freeze(['auto_tags', 'semantic_parse'])],
  ['keyword:', Object.freeze(['keyword'])],
  ['topic:', Object.freeze(['topic'])],
  ['classification:', Object.freeze(['classification'])],
  ['thought:', Object.freeze(['thought'])],
  ['evolution:', Object.freeze(['evolution'])],
]);

export class GenericEntry {
  constructor(nodeId, resolvedProps, text) {
    Object.assign(this, resolvedProps);
    this.id = nodeId;
    this.kind = resolvedProps.kind;
    this.writerId = resolvedProps.writerId;
    this.createdAt = resolvedProps.createdAt;
    this.sortKey = String(resolvedProps.sortKey || '');
    this.text = text;
    this.source = resolvedProps.source ?? null;
    this.channel = resolvedProps.channel ?? null;
  }
}

export class CaptureEntry extends GenericEntry {
  constructor(nodeId, resolvedProps, text) {
    super(nodeId, resolvedProps, text);
    this.source = resolvedProps.source;
    this.channel = resolvedProps.channel;
    this.thoughtId = resolvedProps.thoughtId ?? null;
    this.sessionId = resolvedProps.sessionId ?? null;
    this.ambientCwd = resolvedProps.ambientCwd ?? null;
    this.ambientGitRoot = resolvedProps.ambientGitRoot ?? null;
    this.ambientGitRemote = resolvedProps.ambientGitRemote ?? null;
    this.ambientGitBranch = resolvedProps.ambientGitBranch ?? null;
    this.captureProvenance = captureProvenanceFrom(resolvedProps);
    Object.freeze(this);
  }
}

export class ReflectEntry extends GenericEntry {
  constructor(nodeId, resolvedProps, text) {
    super(nodeId, resolvedProps, text);
    this.seedEntryId = resolvedProps.seedEntryId ?? null;
    this.contrastEntryId = resolvedProps.contrastEntryId ?? null;
    this.sessionId = resolvedProps.sessionId ?? null;
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

export class AnnotationEntry extends GenericEntry {
  constructor(nodeId, resolvedProps, text) {
    super(nodeId, resolvedProps, text);
    this.targetEntryId = resolvedProps.targetEntryId ?? null;
    Object.freeze(this);
  }
}

export class BaseEntry {
  static from(nodeId, resolvedProps, text) {
    if (resolvedProps.kind === 'capture') {
      return new CaptureEntry(nodeId, resolvedProps, text);
    }
    if (resolvedProps.kind === 'reflect' || SESSION_KINDS.includes(resolvedProps.kind)) {
      return new ReflectEntry(nodeId, resolvedProps, text);
    }
    if (resolvedProps.kind === 'annotation') {
      return new AnnotationEntry(nodeId, resolvedProps, text);
    }
    return Object.freeze(new GenericEntry(nodeId, resolvedProps, text));
  }
}

export async function openProductReadHandle(repoDir) {
  const memory = await openNativeMemory(repoDir);
  return Object.freeze({
    repoDir,
    memory,
    writerId: memory.writerId,
    readDocument: nodeId => readIndexedMemoryDocument(repoDir, nodeId, {
      kinds: indexedKindsForId(nodeId),
      memory,
    }),
    listDocumentsByKind: (kind, options) =>
      listIndexedMemoryDocuments(repoDir, kind, {
        ...options,
        memory,
      }),
  });
}

export async function clearWarpRuntimeCache(repoDir) {
  await closeNativeMemory(repoDir);
}

export async function getGraphModelStatusForRead(read) {
  const document = decodeNativeDocument(
    await read.memory.memoryDocument(GRAPH_META_ID),
    'memory-object'
  );
  const currentGraphModelVersion = Number(
    document?.graphModelVersion ?? GRAPH_MODEL_VERSION
  );
  return Object.freeze({
    currentGraphModelVersion,
    requiredGraphModelVersion: GRAPH_MODEL_VERSION,
    migrationRequired: currentGraphModelVersion < GRAPH_MODEL_VERSION,
  });
}

export async function getStoredEntry(read, nodeId, props = null) {
  const document = props ?? await read.readDocument(nodeId);
  if (!document?.kind) {
    return null;
  }
  return BaseEntry.from(nodeId, document, document.text ?? '');
}

function indexedKindsForId(nodeId) {
  return INDEXED_KINDS_BY_PREFIX
    .find(([prefix]) => nodeId.startsWith(prefix))?.[1]
    ?? NO_INDEXED_KINDS;
}

export function toBrowseEntry(entry) {
  if (!entry) {
    return null;
  }
  return Object.freeze({
    id: entry.id,
    text: entry.text,
    sortKey: entry.sortKey,
    createdAt: entry.createdAt,
    sessionId: entry.sessionId ?? null,
  });
}

export async function getReflectSession(read, sessionId) {
  const session = await getStoredEntry(read, sessionId);
  return session && SESSION_KINDS.includes(session.kind) ? session : null;
}

export async function listEntriesByKind(read, kind, {
  limit = 500,
} = {}) {
  const documents = await read.listDocumentsByKind(kind, { limit });
  return documents
    .filter(document => document.kind === kind)
    .map(document => BaseEntry.from(document.id, document, document.text ?? ''));
}

export async function listEntryPropsByKind(read, kind, {
  limit = 500,
} = {}) {
  const entries = await listEntriesByKind(read, kind, { limit });
  return entries.map(entry => Object.freeze({
    id: entry.id,
    ...entryProps(entry),
  }));
}

export async function listChronologyEntries(read) {
  const entries = await listRecentStoredEntries(read, {
    kind: 'capture',
    limit: 4096,
  });
  return entries.map(toBrowseEntry);
}

export async function getSingleNeighborId(read, nodeId, direction, label) {
  if (direction !== 'outgoing') {
    return null;
  }
  const document = await read.readDocument(nodeId);
  const field = Object.freeze({
    annotates: 'targetEntryId',
    derived_from: 'primaryInputId',
    produced_in: 'sessionId',
    responds_to: 'seedEntryId',
    seeded_by: 'seedEntryId',
  })[label];
  return field ? document?.[field] ?? null : null;
}

export async function getLatestStoredEntry(read, kind = 'capture', {
  excludeIds = [],
} = {}) {
  const entries = await listEntriesByKind(read, kind, {
    limit: excludeIds.length + 1,
  });
  const excluded = new Set(excludeIds);
  return entries.find(entry => !excluded.has(entry.id)) ?? null;
}

export async function listRecentStoredEntries(read, {
  kind = 'capture',
  limit = 50,
} = {}) {
  return await listEntriesByKind(read, kind, { limit });
}

export async function* iterateRecentStoredEntries(read, options = {}) {
  for (const entry of await listRecentStoredEntries(read, options)) {
    yield entry;
  }
}

export async function readNodeText(read, nodeId, props = null) {
  if (typeof props?.text === 'string') {
    return props.text;
  }
  const entry = await getStoredEntry(read, nodeId);
  return entry?.text ?? '';
}

export async function getLatestCaptureId(read, {
  excludeIds = [],
} = {}) {
  const excluded = new Set(excludeIds);
  const entries = await listEntriesByKind(read, 'capture', {
    limit: excludeIds.length + 1,
  });
  return entries.find(entry => !excluded.has(entry.id))?.id ?? null;
}

export function getProducedInSessionId(_read, entry) {
  return entry.sessionId ?? null;
}

export async function hasNode(read, nodeId) {
  return await read.readDocument(nodeId) !== null;
}

export async function resolveHistorySessionTraversal(read, entry) {
  if (!entry?.sessionId) {
    return emptySessionTraversal();
  }
  const captureProps = await listIndexedCaptureProps(read, { limit: 4096 });
  const sessionProps = resolveHistorySessionEntries(captureProps, entry);
  const entries = await Promise.all(
    sessionProps.map(props => props.id === entry.id
      ? Promise.resolve(toBrowseEntry(entry))
      : getStoredEntry(read, props.id).then(toBrowseEntry))
  );
  const visible = entries.filter(Boolean);
  const sessionIndex = visible.findIndex(candidate => candidate.id === entry.id);
  return Object.freeze({
    entries: visible,
    sessionCount: visible.length,
    sessionPosition: sessionIndex < 0 ? null : sessionIndex + 1,
    previous: sessionIndex > 0 ? visible[sessionIndex - 1] : null,
    next: sessionIndex >= 0 && sessionIndex + 1 < visible.length
      ? visible[sessionIndex + 1]
      : null,
  });
}

export const resolveGraphSessionTraversal = resolveHistorySessionTraversal;

export async function listIndexedCaptureProps(read, {
  limit = 50,
} = {}) {
  const entries = await listRecentStoredEntries(read, {
    kind: 'capture',
    limit,
  });
  return entries.map(entry => Object.freeze({
    id: entry.id,
    ...entryProps(entry),
  }));
}

export async function listStoredEntriesByRefs(read, refs, {
  limit = 50,
  kind = 'capture',
} = {}) {
  const selected = refs.slice(0, Math.max(0, limit));
  const entries = await Promise.all(selected.map(ref => getStoredEntry(read, ref.id)));
  return entries
    .filter(entry => entry && (!kind || entry.kind === kind))
    .sort(compareEntriesNewestFirst);
}

export async function getChronologyNeighborEntries(read, currentEntry) {
  const entries = await listRecentStoredEntries(read, {
    kind: 'capture',
    limit: 4096,
  });
  const currentIndex = entries.findIndex(entry => entry.id === currentEntry.id);
  if (currentIndex < 0) {
    return Object.freeze({ newer: null, older: null });
  }
  return Object.freeze({
    newer: entries[currentIndex - 1] ?? null,
    older: entries[currentIndex + 1] ?? null,
  });
}

export async function getIndexSummary(read, kind) {
  return await readNativeIndexSummary(read.repoDir, kind);
}

function captureProvenanceFrom(props) {
  if (!props.captureIngress && !props.captureSourceApp && !props.captureSourceURL) {
    return null;
  }
  return Object.freeze({
    ingress: props.captureIngress ?? null,
    sourceApp: props.captureSourceApp ?? null,
    sourceURL: props.captureSourceURL ?? null,
  });
}

function entryProps(entry) {
  return Object.freeze(Object.fromEntries(
    ENTRY_FACTS
      .filter(key => key !== 'text' && entry[key] !== null && entry[key] !== undefined)
      .map(key => [key, entry[key]])
  ));
}

function emptySessionTraversal() {
  return Object.freeze({
    entries: [],
    sessionCount: 0,
    sessionPosition: null,
    previous: null,
    next: null,
  });
}
