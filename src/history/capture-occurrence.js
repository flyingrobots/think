import {
  PortNotImplementedError,
  ThinkError,
  ValidationError,
} from '../errors.js';

export const CAPTURE_OCCURRENCE_PROFILE = 'think.capture.v1';
export const CAPTURE_REPLAY_PROFILE = 'think.replay-provenance.v1';
export const CAPTURE_SUBJECT_NAMESPACE = 'think-capture';

const ADMITTED_OUTCOMES = Object.freeze(['derived', 'plural']);
const OID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

export class CaptureAdmission {
  constructor(fields) {
    const input = requireRecord(fields, 'CaptureAdmission');
    this.captureId = requireString(input.captureId, 'captureId');
    this.captureIntentId = requireString(input.captureIntentId, 'captureIntentId');
    this.body = requireString(input.body, 'body');
    this.capturedAt = requireIsoDate(input.capturedAt, 'capturedAt');
    this.source = requireString(input.source, 'source');
    this.channel = requireString(input.channel, 'channel');
    this.sourceWriterId = requireString(input.sourceWriterId, 'sourceWriterId');
    this.sourceSortKey = requireString(input.sourceSortKey, 'sourceSortKey');
    this.sessionId = requireNullableString(input.sessionId, 'sessionId');
    Object.freeze(this);
  }

  static fromPropertyValue(value) {
    return new CaptureAdmission(value);
  }

  toPropertyValue() {
    return Object.freeze({
      captureId: this.captureId,
      captureIntentId: this.captureIntentId,
      body: this.body,
      capturedAt: this.capturedAt,
      source: this.source,
      channel: this.channel,
      sourceWriterId: this.sourceWriterId,
      sourceSortKey: this.sourceSortKey,
      sessionId: this.sessionId,
    });
  }
}

export class CaptureReplayProvenance {
  constructor(fields) {
    const input = requireRecord(fields, 'CaptureReplayProvenance');
    this.migrationBatchId = requireString(
      input.migrationBatchId,
      'migrationBatchId'
    );
    this.sourceLane = requireString(input.sourceLane, 'sourceLane');
    this.sourceBasis = requireString(input.sourceBasis, 'sourceBasis');
    this.sourceDigest = requireDigest(input.sourceDigest, 'sourceDigest');
    this.sourcePage = requireNullableString(input.sourcePage, 'sourcePage');
    this.sourceOrdinal = requireOrdinal(input.sourceOrdinal, 'sourceOrdinal');
    this.replayOrdinal = requireOrdinal(input.replayOrdinal, 'replayOrdinal');
    Object.freeze(this);
  }

  static fromPropertyValue(value) {
    return new CaptureReplayProvenance(value);
  }

  toPropertyValue() {
    return Object.freeze({
      migrationBatchId: this.migrationBatchId,
      sourceLane: this.sourceLane,
      sourceBasis: this.sourceBasis,
      sourceDigest: this.sourceDigest,
      sourcePage: this.sourcePage,
      sourceOrdinal: this.sourceOrdinal,
      replayOrdinal: this.replayOrdinal,
    });
  }
}

export class CaptureBasis {
  constructor(fields) {
    const input = requireRecord(fields, 'CaptureBasis');
    this.lane = requireString(input.lane, 'lane');
    this.checkpointSha = requireOid(input.checkpointSha, 'checkpointSha');
    this.frontier = freezeFrontier(input.frontier);
    Object.freeze(this);
  }
}

export class CaptureOccurrence {
  constructor(fields) {
    const input = requireRecord(fields, 'CaptureOccurrence');
    if (!(input.capture instanceof CaptureAdmission)) {
      throw new ValidationError('CaptureOccurrence.capture must be a CaptureAdmission');
    }
    if (!(input.replay instanceof CaptureReplayProvenance)) {
      throw new ValidationError(
        'CaptureOccurrence.replay must be CaptureReplayProvenance'
      );
    }
    this.representationSubject = requireString(
      input.representationSubject,
      'representationSubject'
    );
    this.capture = input.capture;
    this.replay = input.replay;
    this.basis = requireCaptureBasis(input.basis);
    Object.freeze(this);
  }
}

export class CaptureAdmissionReceipt {
  constructor(fields) {
    const input = requireRecord(fields, 'CaptureAdmissionReceipt');
    this.captureId = requireString(input.captureId, 'captureId');
    this.captureIntentId = requireString(input.captureIntentId, 'captureIntentId');
    this.representationSubject = requireString(
      input.representationSubject,
      'representationSubject'
    );
    this.occurrence = requireString(input.occurrence, 'occurrence');
    this.outcome = requireAdmittedOutcome(input.outcome);
    this.evidenceBasis = requireString(input.evidenceBasis, 'evidenceBasis');
    Object.freeze(this);
  }
}

export class CaptureEnumerationUnavailableError extends ThinkError {
  constructor(basis) {
    super(
      'git-warp 19.1 exposes no supported basis-bound entity enumeration',
      'CAPTURE_ENUMERATION_UNAVAILABLE'
    );
    this.name = 'CaptureEnumerationUnavailableError';
    this.basis = requireCaptureBasis(basis);
    Object.freeze(this);
  }
}

export class CaptureOccurrenceStorePort {
  admit() {
    throw new PortNotImplementedError('CaptureOccurrenceStorePort', 'admit');
  }

  read() {
    throw new PortNotImplementedError('CaptureOccurrenceStorePort', 'read');
  }

  enumerate() {
    throw new PortNotImplementedError('CaptureOccurrenceStorePort', 'enumerate');
  }

  close() {
    throw new PortNotImplementedError('CaptureOccurrenceStorePort', 'close');
  }
}

function requireRecord(value, name) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireNullableString(value, name) {
  return value === null ? null : requireString(value, name);
}

function requireIsoDate(value, name) {
  const text = requireString(value, name);
  let canonical;
  try {
    canonical = new Date(text).toISOString();
  } catch {
    throw new ValidationError(`${name} must be a canonical ISO timestamp`);
  }
  if (canonical !== text) {
    throw new ValidationError(`${name} must be a canonical ISO timestamp`);
  }
  return text;
}

function requireDigest(value, name) {
  const text = requireString(value, name);
  if (!/^[0-9a-f]{64}$/u.test(text)) {
    throw new ValidationError(`${name} must be a lowercase SHA-256 digest`);
  }
  return text;
}

function requireOid(value, name) {
  const text = requireString(value, name);
  if (!OID_PATTERN.test(text)) {
    throw new ValidationError(`${name} must be a lowercase Git object ID`);
  }
  return text;
}

function requireOrdinal(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function requireAdmittedOutcome(value) {
  if (!ADMITTED_OUTCOMES.includes(value)) {
    throw new ValidationError('outcome must be derived or plural');
  }
  return value;
}

function requireCaptureBasis(value) {
  if (!(value instanceof CaptureBasis)) {
    throw new ValidationError('basis must be a CaptureBasis');
  }
  return value;
}

function freezeFrontier(value) {
  if (!Array.isArray(value)) {
    throw new ValidationError('frontier must be an array');
  }
  return Object.freeze(value.map(freezeFrontierEntry));
}

function freezeFrontierEntry(value) {
  const input = requireRecord(value, 'frontier entry');
  return Object.freeze({
    writerId: requireString(input.writerId, 'frontier.writerId'),
    patchSha: requireOid(input.patchSha, 'frontier.patchSha'),
  });
}
