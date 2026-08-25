import {
  DERIVER_NAME,
  DERIVER_VERSION,
  REFLECT_MARKERS,
  REFLECT_PROMPT_TYPES,
  SCHEMA_VERSION,
  SESSION_IDLE_GAP_MS,
  SESSION_PREFIX,
} from './constants.js';
import {
  compareEntriesNewestFirst,
  createArtifactId,
  createThoughtId,
  getCurrentTime,
  normalizeSeed,
} from './model.js';
import {
  listEntriesByKind,
} from './runtime.js';

export function assessReflectability(text) {
  const seedQuality = deriveSeedQuality(createThoughtId(text), text);
  if (seedQuality.verdict === 'likely_reflectable') {
    return Object.freeze({
      eligible: true,
      kind: 'pressure_testable',
      text: 'This entry looks like a candidate idea, question, or decision that can be pressure-tested.',
    });
  }
  return Object.freeze({
    eligible: false,
    kind: 'not_pressure_testable',
    text: 'This entry looks more like a note than a pressure-testable idea.',
    suggestion: 'Pick a different seed or capture a sharper claim first.',
  });
}

export async function listDirectDerivedReceipts(read, seedEntryId) {
  const reflectEntries = await listEntriesByKind(read, 'reflect');
  return reflectEntries
    .filter(entry => entry.seedEntryId === seedEntryId)
    .sort(compareEntriesNewestFirst)
    .map(entry => Object.freeze({
      relation: 'seed_of',
      kind: entry.kind,
      entryId: entry.id,
      sessionId: entry.sessionId,
      promptType: entry.promptType,
      createdAt: entry.createdAt,
    }));
}

export function deriveSeedQuality(thoughtId, text) {
  const normalized = normalizeSeed(text);
  const eligible = REFLECT_MARKERS.some(pattern => pattern.test(normalized));
  return Object.freeze({
    artifactId: createArtifactId('seed_quality', thoughtId),
    kind: 'seed_quality',
    primaryInputKind: 'thought',
    primaryInputId: thoughtId,
    verdict: eligible ? 'likely_reflectable' : 'weak_note',
    reasonKind: eligible ? 'proposal_or_question_markers' : 'status_like_note',
    reasonText: eligible
      ? 'Contains explicit proposal, uncertainty, or decision language that can be pressure-tested.'
      : 'Reads more like a status, narrative, or observational note than a pressure-testable idea.',
    promptFamilies: Object.freeze(eligible ? [...REFLECT_PROMPT_TYPES] : []),
    deriver: DERIVER_NAME,
    deriverVersion: DERIVER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: getCurrentTime().toISOString(),
  });
}

export async function deriveSessionAttribution(read, entry) {
  const captures = await listEntriesByKind(read, 'capture', { limit: 4096 });
  const latestEntry = captures.find(candidate =>
    candidate.id !== entry.id
    && Date.parse(candidate.createdAt) <= Date.parse(entry.createdAt)
  );
  if (latestEntry && latestEntry.id !== entry.id) {
    const gapMs = Date.parse(entry.createdAt) - Date.parse(latestEntry.createdAt);
    if (gapMs <= SESSION_IDLE_GAP_MS) {
      const activeSessionId = latestEntry.sessionId || `${SESSION_PREFIX}${latestEntry.sortKey}`;
      return buildSessionAttribution(entry, activeSessionId, {
        sessionCreatedAt: latestEntry.createdAt,
        sessionStartSortKey: latestEntry.sortKey,
        reasonKind: 'temporal_proximity',
        reasonText: 'Captured within 5 minutes of the most recent entry.',
      });
    }
  }
  const sessionId = `${SESSION_PREFIX}${entry.sortKey}`;
  return buildSessionAttribution(entry, sessionId, {
    sessionCreatedAt: entry.createdAt,
    sessionStartSortKey: entry.sortKey,
    reasonKind: 'new_session_bucket',
    reasonText: 'Started a new session bucket because no recent capture fell within the 5 minute idle-gap threshold.',
  });
}

export async function getCanonicalThought(read, entry) {
  const thoughtId = entry.thoughtId ?? createThoughtId(entry.text);
  return Object.freeze({
    entryId: entry.id,
    thoughtId,
    relation: 'expresses',
    stored: await read.memory.exists(thoughtId),
  });
}

export function getSeedQualityReceipt(_read, entry) {
  return deriveSeedQuality(entry.thoughtId ?? createThoughtId(entry.text), entry.text);
}

export async function getSessionAttributionReceipt(read, entry) {
  return await deriveSessionAttribution(read, entry);
}

function buildSessionAttribution(entry, sessionId, details) {
  return Object.freeze({
    artifactId: createArtifactId('session_attribution', entry.id, sessionId),
    kind: 'session_attribution',
    primaryInputKind: 'capture',
    primaryInputId: entry.id,
    sessionId,
    ...details,
    deriver: DERIVER_NAME,
    deriverVersion: DERIVER_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: getCurrentTime().toISOString(),
  });
}
