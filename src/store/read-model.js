import { createHash } from 'node:crypto';

import { parseJson, stringifyJson } from '../json.js';
import {
  CAPTURE_READ_MODEL_ID,
  READ_MODEL_PREFIX,
  SCHEMA_VERSION,
} from './constants.js';
import { compareEntriesNewestFirst } from './model.js';

export const CAPTURE_READ_MODEL_LIMIT = 500;
export const AMBIENT_READ_MODEL_LIMIT = 250;
export const AMBIENT_INDEX_KEYS = Object.freeze([
  'ambientGitRemote',
  'ambientGitRoot',
  'ambientCwd',
]);

export function ambientReadModelId(key, value) {
  const fingerprint = createHash('sha256')
    .update(`${key}\0${value}`, 'utf8')
    .digest('hex');
  return `${READ_MODEL_PREFIX}ambient:${key}:${fingerprint}`;
}

export async function readCaptureReadModel(read) {
  const props = await read.view.getNodeProps(CAPTURE_READ_MODEL_ID);
  return normalizeCaptureReadModel(props);
}

export async function readAmbientReadModel(read, key, value) {
  if (!key || !value) {
    return emptyAmbientReadModel(key, value);
  }

  const props = await read.view.getNodeProps(ambientReadModelId(key, value));
  return normalizeAmbientReadModel(key, value, props);
}

export async function readAmbientCaptureRefs(read, scope, { limit = AMBIENT_READ_MODEL_LIMIT } = {}) {
  const refs = new Map();

  for (const { key, value } of ambientScopeDescriptors(scope)) {
    // eslint-disable-next-line no-await-in-loop -- exact bounded read per ambient index key
    const index = await readAmbientReadModel(read, key, value);
    for (const ref of index.refs) {
      refs.set(ref.id, ref);
    }
  }

  return [...refs.values()]
    .sort(compareEntriesNewestFirst)
    .slice(0, normalizeLimit(limit, AMBIENT_READ_MODEL_LIMIT));
}

export async function applyCaptureReadModelPatch(patch, read, entry, {
  ambientContext = null,
} = {}) {
  const ref = normalizeCaptureRef(entry);
  if (!ref) {
    return Object.freeze({ previousLatestRef: null });
  }

  const captureIndex = await readCaptureReadModel(read);
  const nextCaptureIndex = addRefToCaptureReadModel(captureIndex, ref);
  writeCaptureReadModelPatch(patch, nextCaptureIndex);

  for (const { key, value } of ambientContextDescriptors(ambientContext)) {
    // eslint-disable-next-line no-await-in-loop -- exact bounded read per ambient index key
    const ambientIndex = await readAmbientReadModel(read, key, value);
    writeAmbientReadModelPatch(
      patch,
      addRefToAmbientReadModel(ambientIndex, ref)
    );
  }

  return Object.freeze({
    previousLatestRef: captureIndex.refs.find((candidate) => candidate.id !== ref.id) ?? null,
  });
}

export function normalizeCaptureRef(entry) {
  if (!entry?.id || entry.kind !== 'capture') {
    return null;
  }

  return Object.freeze({
    id: entry.id,
    createdAt: entry.createdAt ?? null,
    sortKey: String(entry.sortKey ?? ''),
  });
}

function normalizeCaptureReadModel(props) {
  const refs = parseRefs(props?.recentCaptureRefsJson).slice(0, CAPTURE_READ_MODEL_LIMIT);
  const totalCaptures = Number.isInteger(props?.totalCaptures)
    ? props.totalCaptures
    : refs.length;

  return Object.freeze({
    id: CAPTURE_READ_MODEL_ID,
    kind: 'capture_read_model',
    refs: Object.freeze(refs),
    latestCaptureId: props?.latestCaptureId ?? refs[0]?.id ?? null,
    totalCaptures,
  });
}

function normalizeAmbientReadModel(key, value, props) {
  const refs = parseRefs(props?.recentCaptureRefsJson).slice(0, AMBIENT_READ_MODEL_LIMIT);
  return Object.freeze({
    id: ambientReadModelId(key, value),
    kind: 'ambient_capture_read_model',
    ambientKey: key,
    ambientValue: value,
    refs: Object.freeze(refs),
  });
}

function emptyAmbientReadModel(key, value) {
  return Object.freeze({
    id: value ? ambientReadModelId(key, value) : null,
    kind: 'ambient_capture_read_model',
    ambientKey: key,
    ambientValue: value,
    refs: Object.freeze([]),
  });
}

function addRefToCaptureReadModel(index, ref) {
  const refs = mergeRefs(index.refs, ref, CAPTURE_READ_MODEL_LIMIT);
  const alreadyIndexed = index.refs.some((candidate) => candidate.id === ref.id);
  return Object.freeze({
    ...index,
    refs: Object.freeze(refs),
    latestCaptureId: refs[0]?.id ?? null,
    totalCaptures: alreadyIndexed ? index.totalCaptures : index.totalCaptures + 1,
  });
}

function addRefToAmbientReadModel(index, ref) {
  return Object.freeze({
    ...index,
    refs: Object.freeze(mergeRefs(index.refs, ref, AMBIENT_READ_MODEL_LIMIT)),
  });
}

function mergeRefs(refs, ref, limit) {
  const byId = new Map(refs.map((candidate) => [candidate.id, candidate]));
  byId.set(ref.id, ref);
  return [...byId.values()]
    .sort(compareEntriesNewestFirst)
    .slice(0, limit);
}

function writeCaptureReadModelPatch(patch, index) {
  patch
    .addNode(index.id)
    .setProperty(index.id, 'kind', index.kind)
    .setProperty(index.id, 'schemaVersion', SCHEMA_VERSION)
    .setProperty(index.id, 'latestCaptureId', index.latestCaptureId)
    .setProperty(index.id, 'totalCaptures', index.totalCaptures)
    .setProperty(index.id, 'recentCaptureRefsJson', stringifyJson(index.refs));
}

function writeAmbientReadModelPatch(patch, index) {
  patch
    .addNode(index.id)
    .setProperty(index.id, 'kind', index.kind)
    .setProperty(index.id, 'schemaVersion', SCHEMA_VERSION)
    .setProperty(index.id, 'ambientKey', index.ambientKey)
    .setProperty(index.id, 'ambientValue', index.ambientValue)
    .setProperty(index.id, 'recentCaptureRefsJson', stringifyJson(index.refs));
}

function ambientScopeDescriptors(scope) {
  return [
    { key: 'ambientGitRemote', value: scope.gitRemote },
    { key: 'ambientGitRoot', value: scope.gitRoot },
    { key: 'ambientCwd', value: scope.cwd },
  ].filter((descriptor) => descriptor.value);
}

function ambientContextDescriptors(ambientContext) {
  if (!ambientContext) {
    return [];
  }

  return AMBIENT_INDEX_KEYS
    .map((key) => ({ key, value: ambientContextValue(ambientContext, key) }))
    .filter((descriptor) => descriptor.value);
}

function ambientContextValue(ambientContext, key) {
  if (key === 'ambientGitRemote') { return ambientContext.gitRemote; }
  if (key === 'ambientGitRoot') { return ambientContext.gitRoot; }
  if (key === 'ambientCwd') { return ambientContext.cwd; }
  return null;
}

function parseRefs(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = parseJson(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeRefRecord)
      .filter(Boolean)
      .sort(compareEntriesNewestFirst);
  } catch {
    return [];
  }
}

function normalizeRefRecord(record) {
  if (!record?.id) {
    return null;
  }

  return Object.freeze({
    id: String(record.id),
    createdAt: record.createdAt ? String(record.createdAt) : null,
    sortKey: String(record.sortKey ?? ''),
  });
}

function normalizeLimit(limit, fallback) {
  return Number.isInteger(limit) ? Math.max(0, limit) : fallback;
}
