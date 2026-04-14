import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';

import { ValidationError } from '../errors.js';

import { parseJson } from '../json.js';
import {
  ARTIFACT_PREFIX,
  BUCKET_PERIODS,
  DERIVER_VERSION,
  ENTRY_PREFIX,
  MAX_REFLECT_STEPS,
  REFLECT_SESSION_PREFIX,
  SCHEMA_VERSION,
  TEXT_CONTENT_KINDS,
  THOUGHT_PREFIX,
} from './constants.js';

export function storesTextContent(kind) {
  return TEXT_CONTENT_KINDS.includes(kind);
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
  if (!match) {return null;}

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
  if (!BUCKET_PERIODS.includes(bucket)) {
    throw new Error(`formatBucketKey: invalid bucket "${bucket}" (expected ${BUCKET_PERIODS.join(', ')})`);
  }

  const iso = date.toISOString();
  if (bucket === 'hour') { return `${iso.substring(0, 13)}:00`; }
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

export class Entry {
  constructor(text, writerId, {
    kind,
    source,
    seedEntryId = null,
    contrastEntryId = null,
    sessionId = null,
    promptType = null,
  }) {
    if (!text || typeof text !== 'string') {
      throw new ValidationError('Entry: text is required and must be a non-empty string');
    }
    if (!writerId || typeof writerId !== 'string') {
      throw new ValidationError('Entry: writerId is required and must be a non-empty string');
    }

    const timestamp = getCurrentTime();
    const unique = randomUUID();
    const createdAt = timestamp.toISOString();
    const sortKey = `${String(timestamp.getTime()).padStart(13, '0')}-${unique}`;

    this.id = `${ENTRY_PREFIX}${sortKey}`;
    this.kind = kind;
    this.source = source;
    this.channel = 'cli';
    this.writerId = writerId;
    this.createdAt = createdAt;
    this.sortKey = sortKey;
    this.text = text;
    this.seedEntryId = seedEntryId;
    this.contrastEntryId = contrastEntryId;
    this.sessionId = sessionId;
    this.promptType = promptType;

    Object.freeze(this);
  }
}

export function createEntry(text, writerId, options) {
  return new Entry(text, writerId, options);
}

export class ReflectSession {
  constructor(writerId, {
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

    this.id = `${REFLECT_SESSION_PREFIX}${unique}`;
    this.kind = 'reflect_session';
    this.source = 'reflect';
    this.channel = 'cli';
    this.writerId = writerId;
    this.createdAt = createdAt;
    this.sortKey = sortKey;
    this.seedEntryId = seedEntryId;
    this.contrastEntryId = contrastEntryId;
    this.promptType = promptType;
    this.question = question;
    this.selectionReason = selectionReason;
    this.maxSteps = MAX_REFLECT_STEPS;

    Object.freeze(this);
  }
}

export function createReflectSession(writerId, options) {
  return new ReflectSession(writerId, options);
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
