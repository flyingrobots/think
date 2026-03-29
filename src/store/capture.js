import { getAmbientProjectContext } from '../project-context.js';
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

export async function saveRawCapture(repoDir, thought) {
  const app = await openWarpApp(repoDir);
  const entry = createEntry(thought, app.writerId, { kind: 'capture', source: 'capture' });
  const ambientContext = getAmbientProjectContext(process.cwd());

  await app.patch(async patch => {
    patch
      .addNode(entry.id)
      .setProperty(entry.id, 'kind', entry.kind)
      .setProperty(entry.id, 'source', entry.source)
      .setProperty(entry.id, 'channel', entry.channel)
      .setProperty(entry.id, 'writerId', entry.writerId)
      .setProperty(entry.id, 'createdAt', entry.createdAt)
      .setProperty(entry.id, 'sortKey', entry.sortKey);

    if (ambientContext.cwd) {
      patch.setProperty(entry.id, 'ambientCwd', ambientContext.cwd);
    }
    if (ambientContext.gitRoot) {
      patch.setProperty(entry.id, 'ambientGitRoot', ambientContext.gitRoot);
    }
    if (ambientContext.gitRemote) {
      patch.setProperty(entry.id, 'ambientGitRemote', ambientContext.gitRemote);
    }
    if (ambientContext.gitBranch) {
      patch.setProperty(entry.id, 'ambientGitBranch', ambientContext.gitBranch);
    }

    await patch.attachContent(entry.id, thought, { mime: TEXT_MIME });
  });

  return entry;
}

export async function finalizeCapturedThought(repoDir, entryId, { migrateIfNeeded = false } = {}) {
  const app = await openWarpApp(repoDir);
  const read = await createProductReadHandle(app);
  let entry = await getStoredEntry(read, entryId);

  if (!entry || entry.kind !== 'capture') {
    return {
      entry: null,
      migration: null,
    };
  }

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
