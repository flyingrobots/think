import { normalizeCaptureProvenance } from '../capture-provenance.js';
import { TEXT_MIME } from './constants.js';
import { encodeTextContent } from './content.js';
import { createEntry } from './model.js';
import {
  clearWarpAppCache,
  createProductReadHandle,
  getGraphModelStatusForRead,
  getStoredEntry,
  openProductReadHandle,
  openWarpApp,
} from './runtime.js';
import { ensureCaptureReadEdges, ensureFirstDerivedArtifacts } from './derivation.js';
import { migrateGraphModel } from './migrations.js';
import { getCheckpointGraphModelStatus } from './checkpoint-read.js';

const SAVE_RAW_CAPTURE_MAX_ATTEMPTS = 3;
const WRITER_CAS_CONFLICT_TEXT = 'writer ref was updated by another process';

export async function saveRawCapture(repoDir, thought, {
  provenance = null,
  ambientContext = null,
} = {}) {
  return await saveRawCaptureAttempt(repoDir, thought, {
    provenance,
    ambientContext,
    attempt: 1,
  });
}

async function saveRawCaptureAttempt(repoDir, thought, {
  provenance,
  ambientContext,
  attempt,
}) {
  try {
    return await writeRawCapture(repoDir, thought, {
      provenance,
      ambientContext,
    });
  } catch (error) {
    if (!isWriterCasConflict(error) || attempt >= SAVE_RAW_CAPTURE_MAX_ATTEMPTS) {
      throw error;
    }
    clearWarpAppCache(repoDir);
    return await saveRawCaptureAttempt(repoDir, thought, {
      provenance,
      ambientContext,
      attempt: attempt + 1,
    });
  }
}

async function writeRawCapture(repoDir, thought, {
  provenance,
  ambientContext,
}) {
  const app = await openWarpApp(repoDir);
  const entry = createEntry(thought, app.writerId, { kind: 'capture', source: 'capture' });
  const captureProvenance = normalizeCaptureProvenance(provenance);

  await app.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey);

    applyAmbientContextPatch(patch, entry.id, ambientContext);
    if (captureProvenance?.ingress) {
      patch.setProperty(entry.id, 'captureIngress', captureProvenance.ingress);
    }
    if (captureProvenance?.sourceApp) {
      patch.setProperty(entry.id, 'captureSourceApp', captureProvenance.sourceApp);
    }
    if (captureProvenance?.sourceURL) {
      patch.setProperty(entry.id, 'captureSourceURL', captureProvenance.sourceURL);
    }

    await patch.attachContent(entry.id, encodeTextContent(thought), { mime: TEXT_MIME });
  });

  return entry;
}

function isWriterCasConflict(error) {
  return error instanceof Error && error.message.includes(WRITER_CAS_CONFLICT_TEXT);
}

export async function finalizeCapturedThought(repoDir, entryId, {
  migrateIfNeeded = false,
  ambientContext = null,
} = {}) {
  const app = await openWarpApp(repoDir);
  let read = await createProductReadHandle(app);
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return {
      entry: null,
      migration: null,
    };
  }

  if (ambientContext) {
    await patchAmbientContext(app, entryId, ambientContext);
  }
  read = await createProductReadHandle(app);
  entry = await getStoredEntry(read, entryId);

  await ensureFirstDerivedArtifacts(app, read, entry);
  await ensureCaptureReadEdges(app, read, entryId);
  entry = await getStoredEntry(read, entryId);

  return {
    entry,
    migration: migrateIfNeeded ? await migrateGraphModel(repoDir) : null,
  };
}

export async function getGraphModelStatus(repoDir) {
  const checkpointStatus = await getCheckpointGraphModelStatus(repoDir);
  if (checkpointStatus !== null) {
    return checkpointStatus;
  }
  const read = await openProductReadHandle(repoDir);
  return getGraphModelStatusForRead(read);
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

async function patchAmbientContext(app, entryId, ambientContext) {
  await app.patch(patch => {
    applyAmbientContextPatch(patch, entryId, ambientContext);
  });
}
