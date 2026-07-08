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
const CAPTURE_RECORD_STRING_FIELDS = Object.freeze([
  'writerId',
  'source',
  'channel',
  'thoughtId',
  'sessionId',
]);
const CAPTURE_RECORD_AMBIENT_FIELDS = Object.freeze([
  ['ambientCwd', 'cwd'],
  ['ambientGitRoot', 'gitRoot'],
  ['ambientGitRemote', 'gitRemote'],
  ['ambientGitBranch', 'gitBranch'],
]);
const CAPTURE_RECORD_PROVENANCE_FIELDS = Object.freeze([
  ['captureIngress', 'ingress'],
  ['captureSourceApp', 'sourceApp'],
  ['captureSourceURL', 'sourceURL'],
]);
const EXACT_READ_UNAVAILABLE = Symbol.for('think.exactReadUnavailable');

export function ambientReadModelId(key, value) {
  const fingerprint = createHash('sha256')
    .update(`${key}\0${value}`, 'utf8')
    .digest('hex');
  return `${READ_MODEL_PREFIX}ambient:${key}:${fingerprint}`;
}

export async function readCaptureReadModel(read, { preferFast = true, useExact = true } = {}) {
  const props = await readCaptureReadModelProps(read, { preferFast, useExact });
  return normalizeCaptureReadModel(props);
}

export async function readCaptureRecords(read, { limit = CAPTURE_READ_MODEL_LIMIT } = {}) {
  const index = await readCaptureReadModel(read);
  return index.records.slice(0, normalizeLimit(limit, CAPTURE_READ_MODEL_LIMIT));
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
  const record = normalizeCaptureRecord(entry, { ambientContext });
  if (!ref) {
    return Object.freeze({ previousLatestRef: null });
  }

  const captureIndex = await readCaptureReadModel(read, { preferFast: false, useExact: false });
  const nextCaptureIndex = addCaptureToCaptureReadModel(captureIndex, ref, record);
  writeCaptureReadModelPatch(patch, nextCaptureIndex);

  return Object.freeze({
    previousLatestRef: captureIndex.refs.find((candidate) => candidate.id !== ref.id) ?? null,
  });
}

export function applyPendingCaptureReadModelPatch(patch, entry, {
  ambientContext = null,
} = {}) {
  const ref = normalizeCaptureRef(entry);
  const record = normalizeCaptureRecord(entry, { ambientContext });
  if (!ref) {
    return;
  }

  patch
    .addNode(CAPTURE_READ_MODEL_ID)
    .setProperty(CAPTURE_READ_MODEL_ID, 'kind', 'capture_read_model')
    .setProperty(CAPTURE_READ_MODEL_ID, 'schemaVersion', SCHEMA_VERSION)
    .setProperty(CAPTURE_READ_MODEL_ID, 'latestCaptureId', ref.id)
    .setProperty(CAPTURE_READ_MODEL_ID, 'latestCaptureRefJson', stringifyJson(ref));

  if (record) {
    patch
      .setProperty(CAPTURE_READ_MODEL_ID, 'latestCaptureRecordJson', stringifyJson(record))
      .setProperty(CAPTURE_READ_MODEL_ID, 'fastCaptureRecordsJson', stringifyJson([record]));
  }
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

export function normalizeCaptureRecord(entry, { ambientContext = null } = {}) {
  const ref = normalizeCaptureRef(entry);
  if (!ref) {
    return null;
  }

  const record = {
    ...ref,
    kind: 'capture',
    text: textOrEmpty(entry.text),
  };

  assignStringFields(record, entry, CAPTURE_RECORD_STRING_FIELDS);
  assignAmbientFields(record, entry, ambientContext);
  assignProvenanceFields(record, entry);

  return Object.freeze(record);
}

export function captureRecordToProps(record) {
  const props = {
    kind: 'capture',
    createdAt: record.createdAt,
    sortKey: record.sortKey,
  };

  assignStringFields(props, record, CAPTURE_RECORD_STRING_FIELDS);
  assignStringFields(props, record, CAPTURE_RECORD_AMBIENT_FIELDS.map(([field]) => field));
  assignStringFields(props, record, CAPTURE_RECORD_PROVENANCE_FIELDS.map(([field]) => field));

  return Object.freeze(props);
}

async function readCaptureReadModelProps(read, { preferFast, useExact }) {
  if (useExact && typeof read.readNodeProp === 'function') {
    const recordsJson = await read.readNodeProp(
      CAPTURE_READ_MODEL_ID,
      preferFast ? 'fastCaptureRecordsJson' : 'recentCaptureRecordsJson'
    );
    if (recordsJson === EXACT_READ_UNAVAILABLE) {
      return normalizeReadModelPropsPreference(
        await read.view.getNodeProps(CAPTURE_READ_MODEL_ID),
        { preferFast }
      );
    }
    if (recordsJson !== undefined) {
      return {
        kind: 'capture_read_model',
        recentCaptureRecordsJson: recordsJson,
      };
    }

    return null;
  }

  return await read.view.getNodeProps(CAPTURE_READ_MODEL_ID);
}

function normalizeReadModelPropsPreference(props, { preferFast }) {
  if (!props || !preferFast || props.fastCaptureRecordsJson === undefined) {
    return props;
  }

  return {
    ...props,
    recentCaptureRecordsJson: props.fastCaptureRecordsJson,
  };
}

function normalizeCaptureReadModel(props) {
  const persistedRecords = parseRecords(props?.recentCaptureRecordsJson);
  const pendingLatestRecord = parseRecord(props?.latestCaptureRecordJson);
  const records = mergeRecords(persistedRecords, pendingLatestRecord, CAPTURE_READ_MODEL_LIMIT);
  const persistedRefs = parseRefs(props?.recentCaptureRefsJson);
  const pendingLatestRef = parseRef(props?.latestCaptureRefJson);
  const refs = records.length > 0
    ? records.map(captureRecordToRef)
    : mergePersistedAndPendingRefs(persistedRefs, pendingLatestRef);

  return Object.freeze({
    id: CAPTURE_READ_MODEL_ID,
    kind: 'capture_read_model',
    persistedRefs: Object.freeze(persistedRefs),
    persistedRecords: Object.freeze(persistedRecords),
    refs: Object.freeze(refs),
    records: Object.freeze(records),
    latestCaptureId: latestCaptureIdFromProps(props, refs),
    totalCaptures: totalCapturesFromProps(props, { persistedRefs, persistedRecords }),
  });
}

function mergePersistedAndPendingRefs(persistedRefs, pendingLatestRef) {
  if (!pendingLatestRef) {
    return mergeRefs(persistedRefs, null, CAPTURE_READ_MODEL_LIMIT);
  }

  return mergeRefs([...persistedRefs, pendingLatestRef], null, CAPTURE_READ_MODEL_LIMIT);
}

function latestCaptureIdFromProps(props, refs) {
  return props?.latestCaptureId ?? refs[0]?.id ?? null;
}

function totalCapturesFromProps(props, { persistedRefs, persistedRecords }) {
  if (Number.isInteger(props?.totalCaptures)) {
    return props.totalCaptures;
  }

  return Math.max(persistedRefs.length, persistedRecords.length);
}

function normalizeAmbientReadModel(key, value, props) {
  const records = parseRecords(props?.recentCaptureRecordsJson).slice(0, AMBIENT_READ_MODEL_LIMIT);
  const refs = parseRefs(props?.recentCaptureRefsJson).slice(0, AMBIENT_READ_MODEL_LIMIT);
  return Object.freeze({
    id: ambientReadModelId(key, value),
    kind: 'ambient_capture_read_model',
    ambientKey: key,
    ambientValue: value,
    refs: Object.freeze(refs),
    records: Object.freeze(records),
  });
}

function emptyAmbientReadModel(key, value) {
  return Object.freeze({
    id: value ? ambientReadModelId(key, value) : null,
    kind: 'ambient_capture_read_model',
    ambientKey: key,
    ambientValue: value,
    refs: Object.freeze([]),
    records: Object.freeze([]),
  });
}

function addCaptureToCaptureReadModel(index, ref, record) {
  const refs = mergeRefs(index.refs, ref, CAPTURE_READ_MODEL_LIMIT);
  const records = record
    ? mergeRecords(index.records, record, CAPTURE_READ_MODEL_LIMIT)
    : index.records;
  const alreadyIndexed = index.persistedRefs.some((candidate) => candidate.id === ref.id) ||
    index.persistedRecords.some((candidate) => candidate.id === ref.id);
  return Object.freeze({
    ...index,
    refs: Object.freeze(refs),
    records: Object.freeze(records),
    latestCaptureId: refs[0]?.id ?? null,
    totalCaptures: alreadyIndexed ? index.totalCaptures : index.totalCaptures + 1,
  });
}

function mergeRefs(refs, ref, limit) {
  const byId = new Map(refs.map((candidate) => [candidate.id, candidate]));
  if (ref) {
    byId.set(ref.id, ref);
  }
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
    .setProperty(index.id, 'recentCaptureRefsJson', stringifyJson(index.refs))
    .setProperty(index.id, 'recentCaptureRecordsJson', stringifyJson(index.records))
    .setProperty(index.id, 'fastCaptureRecordsJson', stringifyJson(index.records));
}

function ambientScopeDescriptors(scope) {
  return [
    { key: 'ambientGitRemote', value: scope.gitRemote },
    { key: 'ambientGitRoot', value: scope.gitRoot },
    { key: 'ambientCwd', value: scope.cwd },
  ].filter((descriptor) => descriptor.value);
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

function parseRecords(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = parseJson(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeRecordRecord)
      .filter(Boolean)
      .sort(compareEntriesNewestFirst);
  } catch {
    return [];
  }
}

function parseRef(value) {
  if (!value) {
    return null;
  }

  try {
    return normalizeRefRecord(parseJson(value));
  } catch {
    return null;
  }
}

function parseRecord(value) {
  if (!value) {
    return null;
  }

  try {
    return normalizeRecordRecord(parseJson(value));
  } catch {
    return null;
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

function normalizeRecordRecord(record) {
  const ref = normalizeRefRecord(record);
  if (!ref) {
    return null;
  }

  return Object.freeze({
    ...ref,
    kind: 'capture',
    writerId: stringOrNull(record.writerId),
    text: String(record.text ?? ''),
    source: stringOrNull(record.source),
    channel: stringOrNull(record.channel),
    thoughtId: stringOrNull(record.thoughtId),
    sessionId: stringOrNull(record.sessionId),
    ambientCwd: stringOrNull(record.ambientCwd),
    ambientGitRoot: stringOrNull(record.ambientGitRoot),
    ambientGitRemote: stringOrNull(record.ambientGitRemote),
    ambientGitBranch: stringOrNull(record.ambientGitBranch),
    captureIngress: stringOrNull(record.captureIngress),
    captureSourceApp: stringOrNull(record.captureSourceApp),
    captureSourceURL: stringOrNull(record.captureSourceURL),
  });
}

function captureRecordToRef(record) {
  return Object.freeze({
    id: record.id,
    createdAt: record.createdAt,
    sortKey: record.sortKey,
  });
}

function mergeRecords(records, record, limit) {
  const byId = new Map(records.map((candidate) => [candidate.id, candidate]));
  if (record) {
    byId.set(record.id, record);
  }
  return [...byId.values()]
    .sort(compareEntriesNewestFirst)
    .slice(0, limit);
}

function assignStringFields(target, source, fields) {
  for (const field of fields) {
    target[field] = stringOrNull(source[field]);
  }
}

function assignAmbientFields(target, entry, ambientContext) {
  for (const [recordField, contextField] of CAPTURE_RECORD_AMBIENT_FIELDS) {
    target[recordField] = firstString([
      objectField(ambientContext, contextField),
      entry[recordField],
    ]);
  }
}

function assignProvenanceFields(target, entry) {
  for (const [recordField, provenanceField] of CAPTURE_RECORD_PROVENANCE_FIELDS) {
    target[recordField] = firstString([
      objectField(entry.captureProvenance, provenanceField),
      entry[recordField],
    ]);
  }
}

function firstString(values) {
  for (const value of values) {
    const normalized = stringOrNull(value);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function objectField(value, key) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value[key];
}

function textOrEmpty(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function stringOrNull(value) {
  return typeof value === 'string' ? value : null;
}

function normalizeLimit(limit, fallback) {
  return Number.isInteger(limit) ? Math.max(0, limit) : fallback;
}
