import { normalizeCaptureProvenance } from '../capture-provenance.js';
import {
  GRAPH_META_ID,
  GRAPH_MODEL_VERSION,
} from './constants.js';
import {
  createEntry,
  createThoughtId,
} from './model.js';
import { appendIndexedMemoryObject } from './native-index.js';
import {
  encodeNativeDocument,
} from './native-document.js';
import { openNativeMemory } from './native-runtime.js';
import {
  getGraphModelStatusForRead,
  getStoredEntry,
  openProductReadHandle,
} from './runtime.js';

export async function saveRawCapture(repoDir, thought, {
  provenance = null,
  ambientContext = null,
  initializeGraphModel = false,
} = {}) {
  const memory = await openNativeMemory(repoDir);
  const created = createEntry(
    thought,
    memory.writerId,
    { kind: 'capture', source: 'capture' }
  );
  const captureProvenance = normalizeCaptureProvenance(provenance);
  const thoughtId = createThoughtId(thought);
  const entry = Object.freeze({
    ...created,
    ...captureAmbientFacts(ambientContext),
    ...captureProvenanceFacts(captureProvenance),
    thoughtId,
    sessionId: null,
  });

  await appendIndexedMemoryObject(repoDir, {
    id: entry.id,
    kind: entry.kind,
    facts: captureFacts(entry),
  });

  if (initializeGraphModel) {
    await writeGraphMetadata(memory, entry.createdAt);
  }

  return entry;
}

export async function finalizeCapturedThought(repoDir, entryId) {
  const read = await openProductReadHandle(repoDir);
  const entry = await getStoredEntry(read, entryId);
  return Object.freeze({
    entry: entry?.kind === 'capture' ? entry : null,
    migration: null,
  });
}

export async function getGraphModelStatus(repoDir) {
  const read = await openProductReadHandle(repoDir);
  return await getGraphModelStatusForRead(read);
}

function captureFacts(entry) {
  return Object.freeze({
    kind: entry.kind,
    text: entry.text,
    source: entry.source,
    channel: entry.channel,
    writerId: entry.writerId,
    createdAt: entry.createdAt,
    sortKey: entry.sortKey,
    thoughtId: entry.thoughtId,
    sessionId: entry.sessionId,
    ambientCwd: entry.ambientCwd,
    ambientGitRoot: entry.ambientGitRoot,
    ambientGitRemote: entry.ambientGitRemote,
    ambientGitBranch: entry.ambientGitBranch,
    captureIngress: entry.captureIngress,
    captureSourceApp: entry.captureSourceApp,
    captureSourceURL: entry.captureSourceURL,
  });
}

function captureAmbientFacts(context) {
  const resolved = context ?? {};
  return Object.freeze({
    ambientCwd: nullable(resolved.cwd),
    ambientGitRoot: nullable(resolved.gitRoot),
    ambientGitRemote: nullable(resolved.gitRemote),
    ambientGitBranch: nullable(resolved.gitBranch),
  });
}

function captureProvenanceFacts(provenance) {
  const resolved = provenance ?? {};
  return Object.freeze({
    captureIngress: nullable(resolved.ingress),
    captureSourceApp: nullable(resolved.sourceApp),
    captureSourceURL: nullable(resolved.sourceURL),
  });
}

function nullable(value) {
  return value ?? null;
}

async function writeGraphMetadata(memory, timestamp) {
  const document = Object.freeze({
    id: GRAPH_META_ID,
    kind: 'graph_meta',
    createdAt: timestamp,
    graphModelVersion: GRAPH_MODEL_VERSION,
    updatedAt: timestamp,
  });
  await memory.writeMemoryDocument({
    id: GRAPH_META_ID,
    bytes: encodeNativeDocument('memory-object', document),
  });
}
