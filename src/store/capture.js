import { normalizeCaptureProvenance } from '../capture-provenance.js';
import { GRAPH_META_ID, GRAPH_MODEL_VERSION, TEXT_MIME } from './constants.js';
import { encodeTextContent } from './content.js';
import { createEntry } from './model.js';
import {
  commitThinkWorldline,
  getStoredEntry,
  openThinkWorldline,
  openProductReadHandle,
} from './runtime.js';
import { ensureCaptureReadEdges, ensureFirstDerivedArtifacts } from './derivation.js';
import { migrateGraphModel } from './migrations.js';
import {
  applyCaptureReadModelPatch,
  applyPendingCaptureReadModelPatch,
} from './read-model.js';

export async function saveRawCapture(repoDir, thought, {
  provenance = null,
  ambientContext = null,
} = {}) {
  return await writeRawCapture(repoDir, thought, {
    provenance,
    ambientContext,
  });
}

async function writeRawCapture(repoDir, thought, {
  provenance,
  ambientContext,
}) {
  const worldline = await openThinkWorldline(repoDir);
  const entry = createEntry(thought, worldline.writerId, { kind: 'capture', source: 'capture' });
  const captureProvenance = normalizeCaptureProvenance(provenance);
  const patcher = createRawCapturePatcher(entry, thought, {
    ambientContext,
    captureProvenance,
  });

  await commitThinkWorldline(repoDir, patcher);

  return entry;
}

function createRawCapturePatcher(entry, thought, { ambientContext, captureProvenance }) {
  return async (patch) => {
    applyRawCapturePatch(patch, entry, {
      ambientContext,
      captureProvenance,
    });
    await patch.attachContent(entry.id, encodeTextContent(thought), { mime: TEXT_MIME });
  };
}

function applyRawCapturePatch(patch, entry, { ambientContext, captureProvenance }) {
  applyPendingCaptureReadModelPatch(patch, entry);
  patch
    .addNode(entry.id)
    .setProperty(entry.id, 'kind', entry.kind)
    .setProperty(entry.id, 'source', entry.source)
    .setProperty(entry.id, 'channel', entry.channel)
    .setProperty(entry.id, 'writerId', entry.writerId)
    .setProperty(entry.id, 'createdAt', entry.createdAt)
    .setProperty(entry.id, 'sortKey', entry.sortKey);

  applyAmbientContextPatch(patch, entry.id, ambientContext);
  applyCaptureProvenancePatch(patch, entry.id, captureProvenance);
}

function applyCaptureProvenancePatch(patch, entryId, captureProvenance) {
  if (captureProvenance?.ingress) {
    patch.setProperty(entryId, 'captureIngress', captureProvenance.ingress);
  }
  if (captureProvenance?.sourceApp) {
    patch.setProperty(entryId, 'captureSourceApp', captureProvenance.sourceApp);
  }
  if (captureProvenance?.sourceURL) {
    patch.setProperty(entryId, 'captureSourceURL', captureProvenance.sourceURL);
  }
}

export async function finalizeCapturedThought(repoDir, entryId, {
  migrateIfNeeded = false,
  ambientContext = null,
} = {}) {
  let read = await openProductReadHandle(repoDir);
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return {
      entry: null,
      migration: null,
    };
  }

  await patchCaptureReadModel(repoDir, entry, ambientContext);
  read = await openProductReadHandle(repoDir);
  entry = await getStoredEntry(read, entryId);

  await ensureFirstDerivedArtifacts(repoDir, read, entry);
  read = await openProductReadHandle(repoDir);
  await ensureCaptureReadEdges(repoDir, read, entryId);
  read = await openProductReadHandle(repoDir);
  entry = await getStoredEntry(read, entryId);

  return {
    entry,
    migration: migrateIfNeeded ? await migrateGraphModel(repoDir) : null,
  };
}

export async function getGraphModelStatus(repoDir) {
  const worldline = await openThinkWorldline(repoDir);
  const graphMeta = await worldline.live().getNodeProps(GRAPH_META_ID);
  const currentGraphModelVersion = Number(graphMeta?.graphModelVersion ?? 1);
  return {
    currentGraphModelVersion,
    requiredGraphModelVersion: GRAPH_MODEL_VERSION,
    migrationRequired: currentGraphModelVersion < GRAPH_MODEL_VERSION,
  };
}

function applyAmbientContextPatch(patch, entryId, ambientContext) {
  if (!ambientContext) {
    return;
  }

  if (ambientContext.cwd) {
    patch.setProperty(entryId, 'ambientCwd', ambientContext.cwd);
  }
  if (ambientContext.gitRoot) {
    patch.setProperty(entryId, 'ambientGitRoot', ambientContext.gitRoot);
  }
  if (ambientContext.gitRemote) {
    patch.setProperty(entryId, 'ambientGitRemote', ambientContext.gitRemote);
  }
  if (ambientContext.gitBranch) {
    patch.setProperty(entryId, 'ambientGitBranch', ambientContext.gitBranch);
  }
}

async function patchCaptureReadModel(repoDir, entry, ambientContext) {
  const patcher = async (patch) => {
    const read = await openProductReadHandle(repoDir);
    await applyCaptureReadModelPatch(patch, read, entry, { ambientContext });
    applyAmbientContextPatch(patch, entry.id, ambientContext);
  };

  await commitThinkWorldline(repoDir, patcher);
}
