import {
  getAmbientProjectContext,
  getCaptureAmbientContext,
} from '../project-context.js';
import { normalizeCaptureProvenance } from '../capture-provenance.js';
import { TEXT_MIME } from './constants.js';
import { createEntry } from './model.js';
import {
  createProductReadHandle,
  getGraphModelStatusForRead,
  getStoredEntry,
  openProductReadHandle,
  openWarpApp,
} from './runtime.js';
import { ensureCaptureReadEdges, ensureFirstDerivedArtifacts } from './derivation.js';
import { migrateGraphModel } from './migrations.js';

export async function saveRawCapture(repoDir, thought, {
  provenance = null,
  cwd = process.cwd(),
  ambientContext = null,
} = {}) {
  const app = await openWarpApp(repoDir);
  const entry = createEntry(thought, app.writerId, { kind: 'capture', source: 'capture' });
  const captureAmbientContext = ambientContext ?? getCaptureAmbientContext(cwd);
  // Keep the store boundary defensive because direct callers can bypass the
  // CLI and MCP normalization helpers before reaching persistence.
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

    applyAmbientContextPatch(patch, entry.id, captureAmbientContext);
    if (captureProvenance?.ingress) {
      patch.setProperty(entry.id, 'captureIngress', captureProvenance.ingress);
    }
    if (captureProvenance?.sourceApp) {
      patch.setProperty(entry.id, 'captureSourceApp', captureProvenance.sourceApp);
    }
    if (captureProvenance?.sourceURL) {
      patch.setProperty(entry.id, 'captureSourceURL', captureProvenance.sourceURL);
    }

    await patch.attachContent(entry.id, thought, { mime: TEXT_MIME });
  });

  return entry;
}

export async function finalizeCapturedThought(repoDir, entryId, {
  migrateIfNeeded = false,
  cwd = process.cwd(),
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

  const resolvedAmbientContext = ambientContext ?? getAmbientProjectContext(cwd);
  await patchAmbientContext(app, entryId, resolvedAmbientContext);
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
