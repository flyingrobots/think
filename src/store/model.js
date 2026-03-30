import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';

import { parseJson } from '../json.js';
import {
  ARTIFACT_PREFIX,
  DERIVER_VERSION,
  ENTRY_PREFIX,
  MAX_REFLECT_STEPS,
  REFLECT_SESSION_PREFIX,
  SCHEMA_VERSION,
  THOUGHT_PREFIX,
} from './constants.js';

export function storesTextContent(kind) {
  return kind === 'capture' || kind === 'reflect' || kind === 'thought';
}

export function getCurrentTime() {
  if (process.env.THINK_TEST_NOW) {
    const ms = parseInt(process.env.THINK_TEST_NOW, 10);
    if (!Number.isNaN(ms)) {
      return new Date(ms);
    }
  }

  return new Date();
}

export function parseSince(since, now) {
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

export function formatBucketKey(date, bucket) {
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

export function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stableHash(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function normalizeSeed(text) {
  return String(text).trim().toLowerCase();
}

export function createThoughtId(text) {
  const fingerprint = createHash('sha256')
    .update(String(text), 'utf8')
    .digest('hex');

  return `${THOUGHT_PREFIX}${fingerprint}`;
}

export function createArtifactId(kind, primaryInputId, discriminator = '') {
  const fingerprint = createHash('sha256')
    .update([kind, primaryInputId, discriminator, DERIVER_VERSION, SCHEMA_VERSION].join('\0'), 'utf8')
    .digest('hex');

  return `${ARTIFACT_PREFIX}${fingerprint}`;
}

export function createWriterId() {
  const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const safeHostname = hostname || 'unknown-host';
  return `local.${safeHostname}.cli`;
}

export function createEntry(text, writerId, { kind, source }) {
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

export function createReflectSession(writerId, {
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

export function compareEntriesNewestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return right.id.localeCompare(left.id);
  }

  return right.sortKey.localeCompare(left.sortKey);
}

export function compareEntriesOldestFirst(left, right) {
  if (left.sortKey === right.sortKey) {
    return left.id.localeCompare(right.id);
  }

  return left.sortKey.localeCompare(right.sortKey);
}
