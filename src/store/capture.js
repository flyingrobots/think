import { normalizeCaptureProvenance } from '../capture-provenance.js';
import { GRAPH_META_ID, GRAPH_MODEL_VERSION, TEXT_MIME } from './constants.js';
import { encodeTextContent } from './content.js';
import { createEntry } from './model.js';
import {
  commitThinkWorldline,
  createProductReadHandle,
  getStoredEntry,
  openThinkWorldline,
  openWarpApp,
} from './runtime.js';
import { ensureCaptureReadEdges, ensureFirstDerivedArtifacts } from './derivation.js';
import { migrateGraphModel } from './migrations.js';

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

  const patcher = async (patch) => {
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
  };

  await commitThinkWorldline(repoDir, patcher);

  return entry;
}

export async function finalizeCapturedThought(repoDir, entryId, {
  migrateIfNeeded = false,
  ambientContext = null,
} = {}) {
  let app = await openWarpApp(repoDir);

  if (ambientContext) {
    await patchAmbientContext(repoDir, entryId, ambientContext);
    app = await openWarpApp(repoDir);
  }

  let read = await createProductReadHandle(app, repoDir);
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return {
      entry: null,
      migration: null,
    };
  }

  await ensureFirstDerivedArtifacts(repoDir, read, entry);
  app = await openWarpApp(repoDir);
  read = await createProductReadHandle(app, repoDir);
  await ensureCaptureReadEdges(repoDir, read, entryId);
  app = await openWarpApp(repoDir);
  read = await createProductReadHandle(app, repoDir);
  entry = await getStoredEntry(read, entryId);

  return {
    entry,
    migration: migrateIfNeeded ? await migrateGraphModel(repoDir) : null,
  };
}

export async function getGraphModelStatus(repoDir) {
  const worldline = await openThinkWorldline(repoDir);
  await worldline.prepareOpticBasis();
  const coordinate = await worldline.coordinate();
  const fact = await coordinate
    .optic()
    .node(GRAPH_META_ID)
    .prop('graphModelVersion')
    .read();
  const currentGraphModelVersion = Number(fact?.value ?? 1);
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

async function patchAmbientContext(repoDir, entryId, ambientContext) {
  const patcher = (patch) => {
    applyAmbientContextPatch(patch, entryId, ambientContext);
  };

  await commitThinkWorldline(repoDir, patcher);
}
