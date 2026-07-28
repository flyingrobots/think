import { createHash } from 'node:crypto';

import { ValidationError } from '../errors.js';
import { parseJson, stringifyJson } from '../json.js';
import { READ_MODEL_PREFIX } from './constants.js';

export const THINK_RECORD_KEY = 'think.record.v1';
export const THINK_RECORD_VERSION = 1;
export const THINK_CATALOG_SHARD_COUNT = 4;

const THINK_CATALOG_PREFIX = `${READ_MODEL_PREFIX}v19:catalog:`;

export function createEmptyThinkRecord() {
  return Object.freeze({
    version: THINK_RECORD_VERSION,
    props: Object.freeze({}),
    text: null,
    incoming: Object.freeze([]),
    outgoing: Object.freeze([]),
  });
}

export function parseThinkRecord(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    return normalizeThinkRecord(parseJson(value));
  } catch {
    return null;
  }
}

export function stringifyThinkRecord(record) {
  return stringifyJson(normalizeThinkRecord(record));
}

export function withThinkRecordProps(record, props) {
  return normalizeThinkRecord({
    ...record,
    props: {
      ...record.props,
      ...props,
    },
  });
}

export function withThinkRecordText(record, text) {
  return normalizeThinkRecord({
    ...record,
    text,
  });
}

export function withThinkRecordEdge(record, direction, edge) {
  const normalizedEdge = normalizeEdge(edge);
  const current = direction === 'incoming' ? record.incoming : record.outgoing;
  const next = [
    ...current.filter(candidate => !sameEdge(candidate, normalizedEdge)),
    normalizedEdge,
  ].sort(compareEdges);

  return normalizeThinkRecord({
    ...record,
    [direction]: next,
  });
}

export function thinkCatalogShardId(nodeId) {
  const digest = createHash('sha256').update(nodeId, 'utf8').digest();
  const shard = digest.readUInt16BE(0) % THINK_CATALOG_SHARD_COUNT;
  return `${THINK_CATALOG_PREFIX}${String(shard).padStart(2, '0')}`;
}

export function listThinkCatalogShardIds() {
  return Object.freeze(
    Array.from(
      { length: THINK_CATALOG_SHARD_COUNT },
      (_unused, shard) => `${THINK_CATALOG_PREFIX}${String(shard).padStart(2, '0')}`
    )
  );
}

export function addThinkCatalogEntry(record, entry) {
  const current = parseCatalogEntries(record.props.entriesJson);
  const nextById = new Map(current.map(candidate => [candidate.id, candidate]));
  const normalized = normalizeCatalogEntry(entry);
  nextById.set(normalized.id, normalized);
  const entries = [...nextById.values()].sort((left, right) => left.id.localeCompare(right.id));

  return withThinkRecordProps(record, {
    kind: 'v19_catalog',
    entriesJson: stringifyJson(entries),
  });
}

export function readThinkCatalogEntries(record) {
  return parseCatalogEntries(record?.props?.entriesJson);
}

function normalizeThinkRecord(value) {
  if (!isRecord(value) || value.version !== THINK_RECORD_VERSION) {
    throw new ValidationError('Think v19 record must use version 1');
  }

  return Object.freeze({
    version: THINK_RECORD_VERSION,
    props: normalizeProps(value.props),
    text: normalizeText(value.text),
    incoming: normalizeEdges(value.incoming),
    outgoing: normalizeEdges(value.outgoing),
  });
}

function normalizeProps(value) {
  if (!isRecord(value)) {
    throw new ValidationError('Think v19 record props must be an object');
  }
  return Object.freeze({ ...value });
}

function normalizeText(value) {
  if (value !== null && typeof value !== 'string') {
    throw new ValidationError('Think v19 record text must be a string or null');
  }
  return value;
}

function normalizeEdges(value) {
  if (!Array.isArray(value)) {
    throw new ValidationError('Think v19 record edges must be an array');
  }
  return Object.freeze(value.map(normalizeEdge).sort(compareEdges));
}

function normalizeEdge(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') {
    throw new ValidationError('Think v19 record edge must have string id and label fields');
  }
  return Object.freeze({
    id: value.id,
    label: value.label,
  });
}

function normalizeCatalogEntry(value) {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    throw new ValidationError('Think v19 catalog entry must have a non-empty id');
  }
  if (value.kind !== null && value.kind !== undefined && typeof value.kind !== 'string') {
    throw new ValidationError('Think v19 catalog entry kind must be a string or null');
  }
  return Object.freeze({
    id: value.id,
    kind: value.kind ?? null,
  });
}

function parseCatalogEntries(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return Object.freeze([]);
  }

  try {
    const parsed = parseJson(value);
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }
    return Object.freeze(parsed.map(normalizeCatalogEntry));
  } catch {
    return Object.freeze([]);
  }
}

function sameEdge(left, right) {
  return left.id === right.id && left.label === right.label;
}

function compareEdges(left, right) {
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
